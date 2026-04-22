// @ts-check
"use strict";

const crypto = require("node:crypto");

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const { buildProjectDispatchPayload } = require("./project-dispatch");

const githubWebhookSecret = defineSecret("GITHUB_WEBHOOK_SECRET");
const conductorToken = defineSecret("CONDUCTOR_TOKEN");
const githubClientId = defineSecret("GITHUB_CLIENT_ID");
const githubClientSecret = defineSecret("GITHUB_CLIENT_SECRET");

const TARGET_REPO = "LLM-Orchestration/conductor";
const RECOVER_ORPHANED_WORKFLOW_FILE = "recover-orphaned-items.yml";
const DEFAULT_BRANCH = "main";
const TARGET_STATUS = "In Progress";
const TARGET_PROJECT_NUMBER = 1;

/**
 * @typedef {Error & {details?: unknown}} DetailedError
 */

/**
 * @typedef {Object} GitHubAccessTokenResponse
 * @property {string} access_token
 * @property {string} token_type
 * @property {string} scope
 * @property {string} [error]
 * @property {string} [error_description]
 * @property {string} [error_uri]
 */

/**
 * @template T
 * @typedef {Object} GitHubGraphqlResponse
 * @property {Array<{message: string}>} [errors]
 * @property {T} [data]
 */

/**
 * @typedef {Object} ProjectItemNode
 * @property {Object} [node]
 * @property {string} [node.id]
 * @property {Object} [node.status]
 * @property {string} [node.status.name]
 * @property {Object} [node.persona]
 * @property {string} [node.persona.name]
 * @property {Object} [node.project]
 * @property {number} [node.project.number]
 * @property {string} [node.project.title]
 * @property {string} [node.project.url]
 * @property {Object} [node.content]
 * @property {number} [node.content.number]
 * @property {string} [node.content.id]
 * @property {Object} [node.content.labels]
 * @property {Array<{name: string}>} [node.content.labels.nodes]
 * @property {Object} [node.content.repository]
 * @property {string} [node.content.repository.nameWithOwner]
 */

function timingSafeEqualHex(a, b) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  return timingSafeEqualHex(expected, signatureHeader);
}

/**
 * @template T
 * @param {string} query
 * @param {Record<string, unknown>} variables
 * @param {string} token
 * @returns {Promise<T>}
 */
async function githubGraphql(query, variables, token) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "conductor-project-bridge"
    },
    body: JSON.stringify({ query, variables })
  });

  /** @type {GitHubGraphqlResponse<T>} */
  const body = await response.json();
  if (!response.ok || body.errors) {
    /** @type {DetailedError} */
    const error = new Error("GitHub GraphQL request failed");
    error.details = { status: response.status, body };
    throw error;
  }

  if (!body.data) {
    throw new Error("GitHub GraphQL response missing data");
  }

  return body.data;
}

async function githubRest(path, token, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "conductor-project-bridge",
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    /** @type {DetailedError} */
    const error = new Error(`GitHub REST request failed for ${path}`);
    error.details = { status: response.status, body };
    throw error;
  }

  const text = await response.text();
  return text.trim() ? JSON.parse(text) : undefined;
}

async function dispatchProjectActivation(repository, issueNumber, token, eventName, action, issueNodeId, projectNumber, projectUrl, persona = null) {
  const response = await fetch(`https://api.github.com/repos/${TARGET_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "conductor-project-bridge"
    },
    body: JSON.stringify(
      buildProjectDispatchPayload({
        repository,
        issueNumber,
        issueNodeId,
        projectNumber,
        projectUrl,
        persona,
        eventName,
        action
      })
    )
  });

  if (!response.ok) {
    const body = await response.text();
    /** @type {DetailedError} */
    const error = new Error("GitHub repository_dispatch failed");
    error.details = { status: response.status, body };
    throw error;
  }
}

async function dispatchRecoverOrphanedWorkflow(token) {
  await githubRest(
    `/repos/${TARGET_REPO}/actions/workflows/${RECOVER_ORPHANED_WORKFLOW_FILE}/dispatches`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ ref: DEFAULT_BRANCH })
    }
  );
}

exports.githubProjectsV2Webhook = onRequest(
  {
    region: "us-central1",
    secrets: [githubWebhookSecret, conductorToken]
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const eventName = req.get("x-github-event");
    const signature = req.get("x-hub-signature-256");
    const deliveryId = req.get("x-github-delivery") || "unknown";
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), "utf8");

    if (!verifyWebhookSignature(rawBody, signature, githubWebhookSecret.value())) {
      logger.warn("Rejected webhook with invalid signature", { deliveryId, eventName });
      res.status(401).send("Invalid signature");
      return;
    }

    if (eventName === "ping") {
      res.status(204).send("");
      return;
    }

    if (eventName !== "projects_v2_item") {
      logger.info("Ignoring unsupported GitHub event", { deliveryId, eventName });
      res.status(204).send("");
      return;
    }

    const action = req.body?.action;
    if (action !== "edited" && action !== "created") {
      logger.info("Ignoring project item event with unsupported action", {
        deliveryId,
        action: action || null
      });
      res.status(204).send("");
      return;
    }

    const senderType = req.body?.sender?.type;
    const senderLogin = req.body?.sender?.login || "";
    if (senderType === "Bot" || senderLogin.endsWith("[bot]")) {
      logger.info("Ignoring bot event", { deliveryId, senderLogin });
      res.status(204).send("");
      return;
    }

    const changedFieldName = req.body?.changes?.field_value?.field_name;
    if (action === "edited" && changedFieldName !== "Status" && changedFieldName !== "Persona") {
      logger.info("Ignoring non-status/persona project item edit", {
        deliveryId,
        changedFieldName: changedFieldName || null
      });
      res.status(204).send("");
      return;
    }

    const itemNodeId = req.body?.projects_v2_item?.node_id;
    if (!itemNodeId) {
      logger.warn("projects_v2_item payload missing node_id", { deliveryId });
      res.status(400).send("Missing projects_v2_item.node_id");
      return;
    }

    try {
      /** @type {ProjectItemNode} */
      const data = await githubGraphql(
        `query ProjectItemState($id: ID!) {
          node(id: $id) {
            ... on ProjectV2Item {
              id
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
              persona: fieldValueByName(name: "Persona") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
              project {
                ... on ProjectV2 {
                  number
                  title
                  url
                }
              }
              content {
                ... on Issue {
                  number
                  id
                  labels(first: 100) {
                    nodes {
                      name
                    }
                  }
                  repository {
                    nameWithOwner
                  }
                }
              }
            }
          }
        }`,
        { id: itemNodeId },
        conductorToken.value()
      );

      const item = data?.node;
      const issueNumber = item?.content?.number;
      const issueNodeId = item?.content?.id;
      const repositoryName = item?.content?.repository?.nameWithOwner;
      const projectNumber = item?.project?.number;
      const projectUrl = item?.project?.url;
      const statusName = item?.status?.name;
      const personaName = item?.persona?.name;

      if (!issueNumber || !repositoryName || !issueNodeId || !projectUrl) {
        logger.info("Ignoring unrelated project item", {
          deliveryId,
          repositoryName,
          issueNumber,
          issueNodeId,
          projectUrl
        });
        res.status(204).send("");
        return;
      }

      if (projectNumber !== TARGET_PROJECT_NUMBER) {
        logger.info("Ignoring item from untargeted project", {
          deliveryId,
          projectNumber,
          TARGET_PROJECT_NUMBER
        });
        res.status(204).send("");
        return;
      }

      // Trigger if Status is "In Progress" (on creation OR on edit to Status)
      // OR if Persona was changed (only on edit)
      const isStatusTrigger = (action === "created" && statusName === TARGET_STATUS) ||
                              (action === "edited" && changedFieldName === "Status" && statusName === TARGET_STATUS);
      const isPersonaTrigger = action === "edited" && changedFieldName === "Persona";

      if (!isStatusTrigger && !isPersonaTrigger) {
        logger.info("Ignoring project item event: neither status trigger nor persona trigger met", {
          deliveryId,
          issueNumber,
          action,
          changedFieldName,
          statusName
        });
        res.status(204).send("");
        return;
      }

      // If status trigger, we still need status to be TARGET_STATUS
      if (statusName !== TARGET_STATUS) {
        logger.info("Ignoring event because status is not 'In Progress'", {
          deliveryId,
          issueNumber,
          statusName
        });
        res.status(204).send("");
        return;
      }

      await dispatchProjectActivation(repositoryName, issueNumber, conductorToken.value(), eventName, action, issueNodeId, projectNumber, projectUrl, personaName);
      logger.info("Dispatched project activation", { deliveryId, repositoryName, issueNumber, statusName, personaName, projectNumber });
      res.status(202).json({ ok: true, repository: repositoryName, issueNumber, status: statusName, persona: personaName, projectNumber });
    } catch (error) {
      logger.error("Failed to bridge projects_v2_item", {
        deliveryId,
        eventName,
        message: error.message,
        details: error.details || null
      });
      res.status(500).json({
        error: "Bridge failed",
        message: error.message
      });
    }
  }
);

exports.githubOAuthExchange = onRequest(
  {
    region: "us-central1",
    secrets: [githubClientId, githubClientSecret],
    cors: true
  },
  async (req, res) => {
    // Diagnostic log for investigating "empty logs" and request issues
    logger.info("githubOAuthExchange request received", {
      method: req.method,
      has_body: !!req.body,
      body_keys: req.body ? Object.keys(req.body) : []
    });

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { code } = req.body || {};
    if (!code) {
      res.status(400).json({ error: "missing_code" });
      return;
    }

    const clientId = githubClientId.value().trim();
    const clientSecret = githubClientSecret.value().trim();

    logger.info("Starting GitHub OAuth exchange", {
      code: code.substring(0, 5) + "...",
      client_id_diag: {
        first8: clientId.substring(0, 8),
        last4: clientId.substring(clientId.length - 4),
        len: clientId.length
      },
      client_secret_diag: {
        first4: clientSecret.substring(0, 4),
        last4: clientSecret.substring(clientSecret.length - 4),
        len: clientSecret.length
      }
    });

    try {
      const params = new URLSearchParams();
      params.append("client_id", clientId);
      params.append("client_secret", clientSecret);
      params.append("code", code);

      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: params.toString()
      });

      /** @type {GitHubAccessTokenResponse} */
      const data = await response.json();
      logger.info("GitHub OAuth exchange response received", {
        status: response.status,
        has_token: !!data.access_token,
        error: data.error || null
      });

      if (!response.ok || data.error) {
        logger.error("GitHub OAuth exchange error", {
          status: response.status,
          error: data.error,
          error_description: data.error_description,
          error_uri: data.error_uri,
          full_response: data
        });
        res.status(response.status === 200 ? 400 : response.status).json(data);
        return;
      }

      res.status(200).json(data);
    } catch (error) {
      logger.error("Failed to exchange GitHub code", { error: error.message });
      res.status(500).json({ error: "internal_error", message: error.message });
    }
  }
);

exports.recoverOrphanedInProgress = onSchedule(
  {
    region: "us-central1",
    schedule: "3-58/5 * * * *",
    timeZone: "UTC",
    secrets: [conductorToken]
  },
  async () => {
    try {
      await dispatchRecoverOrphanedWorkflow(conductorToken.value());
      logger.info("Scheduled orphan recovery workflow dispatch succeeded", {
        workflow: RECOVER_ORPHANED_WORKFLOW_FILE,
        ref: DEFAULT_BRANCH
      });
    } catch (error) {
      logger.error("Scheduled orphan recovery workflow dispatch failed", {
        message: error.message,
        details: error.details || null
      });
      throw error;
    }
  }
);
