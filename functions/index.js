"use strict";

const crypto = require("crypto");

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");

const githubWebhookSecret = defineSecret("GITHUB_WEBHOOK_SECRET");
const conductorToken = defineSecret("CONDUCTOR_TOKEN");
const githubClientId = defineSecret("GITHUB_CLIENT_ID");
const githubClientSecret = defineSecret("GITHUB_CLIENT_SECRET");

const TARGET_REPO = "LLM-Orchestration/conductor";
const RECOVER_ORPHANED_WORKFLOW_FILE = "recover-orphaned-items.yml";
const DEFAULT_BRANCH = "main";
const TARGET_STATUS = "In Progress";
const TARGET_PROJECT_NUMBER = 1;

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

  const body = await response.json();
  if (!response.ok || body.errors) {
    const error = new Error("GitHub GraphQL request failed");
    error.details = { status: response.status, body };
    throw error;
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
    const error = new Error(`GitHub REST request failed for ${path}`);
    error.details = { status: response.status, body };
    throw error;
  }

  const text = await response.text();
  return text.trim() ? JSON.parse(text) : undefined;
}

async function dispatchProjectActivation(repository, issueNumber, token, eventName = null, action = null, issueNodeId = null, projectNumber = null, projectUrl = null, persona = null) {
  const response = await fetch(`https://api.github.com/repos/${TARGET_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "conductor-project-bridge"
    },
    body: JSON.stringify({
      event_type: "project_in_progress",
      client_payload: {
        repository: repository,
        issue_number: issueNumber,
        issue_node_id: issueNodeId,
        project_number: projectNumber,
        project_url: projectUrl,
        persona: persona,
        event_name: eventName,
        action: action
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
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

      if (!issueNumber || !repositoryName) {
        logger.info("Ignoring unrelated project item", {
          deliveryId,
          repositoryName,
          issueNumber
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
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { code } = req.body || {};
    if (!code) {
      res.status(400).json({ error: "missing_code" });
      return;
    }

    try {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          client_id: githubClientId.value(),
          client_secret: githubClientSecret.value(),
          code
        })
      });

      const data = await response.json();
      if (data.error) {
        logger.error("GitHub OAuth exchange error", data);
        res.status(400).json(data);
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
