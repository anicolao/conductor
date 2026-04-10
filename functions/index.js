"use strict";

const crypto = require("crypto");

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");

const githubWebhookSecret = defineSecret("GITHUB_WEBHOOK_SECRET");
const conductorToken = defineSecret("CONDUCTOR_TOKEN");

const TARGET_REPO = "LLM-Orchestration/conductor";
const TARGET_PROJECT_NUMBER = 1;
const TARGET_STATUS = "In Progress";

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

async function dispatchProjectActivation(repository, issueNumber, token, eventName = null, action = null, body = null) {
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
        project_number: TARGET_PROJECT_NUMBER,
        project_url: "https://github.com/orgs/LLM-Orchestration/projects/1",
        status: TARGET_STATUS,
        event_name: eventName,
        action: action,
        body: body
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

    if (eventName === "issues" || eventName === "issue_comment") {
      const action = req.body?.action;
      const sender = req.body?.sender;

      // Filter: Ignore bots to prevent orchestration loops
      if (sender?.type === "Bot" || sender?.login?.endsWith("[bot]")) {
        logger.info("Ignoring event from bot sender", { deliveryId, sender: sender?.login });
        res.status(204).send("");
        return;
      }

      // Filter actions: only 'opened' for issues and 'created' for issue_comment.
      // This prevents dispatches from label changes (handoffs) which cause duplicate runs.
      if (eventName === "issues" && action !== "opened") {
        logger.info("Ignoring non-opened issue event", { deliveryId, action });
        res.status(204).send("");
        return;
      }
      if (eventName === "issue_comment" && action !== "created") {
        logger.info("Ignoring non-created comment event", { deliveryId, action });
        res.status(204).send("");
        return;
      }

      const body = req.body?.comment?.body || req.body?.issue?.body || "";
      const issueNumber = req.body?.issue?.number;
      const repositoryName = req.body?.repository?.full_name;
      const labels = req.body?.issue?.labels?.map(l => l.name) || [];

      if (!issueNumber || !repositoryName) {
        res.status(400).send("Missing issue number or repository");
        return;
      }

      const hasPersona = labels.some(l => l.startsWith("persona:"));
      const mentionsConductor = body.includes("@conductor");

      if (hasPersona || mentionsConductor) {
        await dispatchProjectActivation(repositoryName, issueNumber, conductorToken.value(), eventName, action, body);
        logger.info("Dispatched issue event", { deliveryId, eventName, action, repositoryName, issueNumber });
        res.status(202).json({ ok: true, repository: repositoryName, issueNumber, eventName });
        return;
      }

      res.status(204).send("");
      return;
    }

    if (eventName !== "projects_v2_item") {
      logger.info("Ignoring unsupported GitHub event", { deliveryId, eventName });
      res.status(204).send("");
      return;
    }

    if (req.body?.action !== "edited") {
      logger.info("Ignoring project item event without an edited action", {
        deliveryId,
        action: req.body?.action || null
      });
      res.status(204).send("");
      return;
    }

    const changedFieldName = req.body?.changes?.field_value?.field_name;
    if (changedFieldName !== "Status") {
      logger.info("Ignoring non-status project item edit", {
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
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
              project {
                ... on ProjectV2 {
                  number
                  title
                }
              }
              content {
                ... on Issue {
                  number
                  body
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
      const issueBody = item?.content?.body;
      const issueLabels = Array.isArray(item?.content?.labels?.nodes)
        ? item.content.labels.nodes.map((label) => label.name)
        : [];
      const repositoryName = item?.content?.repository?.nameWithOwner;
      const projectNumber = item?.project?.number;
      const statusName = item?.fieldValueByName?.name;

      if (!issueNumber || !repositoryName || projectNumber !== TARGET_PROJECT_NUMBER) {
        logger.info("Ignoring unrelated project item", {
          deliveryId,
          repositoryName,
          issueNumber,
          projectNumber
        });
        res.status(204).send("");
        return;
      }

      if (statusName !== TARGET_STATUS) {
        logger.info("Ignoring project item outside target status", {
          deliveryId,
          issueNumber,
          statusName
        });
        res.status(204).send("");
        return;
      }

      if (issueLabels.some((label) => label.startsWith("persona:"))) {
        logger.info("Ignoring project item for issue with active persona", {
          deliveryId,
          issueNumber,
          issueLabels
        });
        res.status(204).send("");
        return;
      }

      await dispatchProjectActivation(repositoryName, issueNumber, conductorToken.value(), eventName, req.body?.action, issueBody);
      logger.info("Dispatched project activation", { deliveryId, repositoryName, issueNumber, statusName });
      res.status(202).json({ ok: true, repository: repositoryName, issueNumber, status: statusName });
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
