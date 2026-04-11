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

async function dispatchConductorEvent(token, eventType, payload) {
  const response = await fetch(`https://api.github.com/repos/${TARGET_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "conductor-project-bridge"
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: payload
    })
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GitHub repository_dispatch failed for ${eventType}`);
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

    // Loop Prevention: Ignore events from bots
    if (req.body?.sender?.type === "Bot") {
      logger.info("Ignoring bot event", { deliveryId, sender: req.body?.sender?.login });
      res.status(204).send("");
      return;
    }

    try {
      if (eventName === "projects_v2_item") {
        if (req.body?.action !== "edited") {
          logger.info("Ignoring project item event without an edited action", {
            deliveryId,
            action: req.body?.action || null
          });
          res.status(204).send("");
          return;
        }

        const changedFieldName = req.body?.changes?.field_value?.field_name;
        if (changedFieldName !== "Status" && changedFieldName !== "Persona") {
          logger.info("Ignoring non-target project item edit", {
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
                  ... on ProjectV2ItemFieldTextValue {
                    text
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
        const issueLabels = Array.isArray(item?.content?.labels?.nodes)
          ? item.content.labels.nodes.map((label) => label.name)
          : [];
        const repositoryName = item?.content?.repository?.nameWithOwner;
        const projectNumber = item?.project?.number;
        const statusName = item?.status?.name;
        const personaValue = item?.persona?.text;

        if (!issueNumber || projectNumber !== TARGET_PROJECT_NUMBER) {
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

        // If Persona field was edited, we dispatch even if labels exist (to continue orchestration).
        // If Status field was edited to "In Progress", we only dispatch if no persona label exists (to start orchestration).
        if (changedFieldName === "Status") {
          if (issueLabels.some((label) => label.startsWith("persona:"))) {
            logger.info("Ignoring Status change for issue with active persona", {
              deliveryId,
              issueNumber,
              issueLabels
            });
            res.status(204).send("");
            return;
          }
        }

        await dispatchConductorEvent(conductorToken.value(), "project_in_progress", {
          issue_number: issueNumber,
          repository: repositoryName,
          project_number: projectNumber,
          project_url: `https://github.com/orgs/${TARGET_REPO.split("/")[0]}/projects/${projectNumber}`,
          status: TARGET_STATUS,
          item_id: itemNodeId,
          persona: personaValue
        });

        logger.info("Dispatched project activation", { deliveryId, issueNumber, repositoryName, statusName, changedFieldName });
        res.status(202).json({ ok: true, issueNumber, repository: repositoryName, status: statusName, changedFieldName });
        return;
      }

      logger.info("Ignoring unsupported GitHub event", { deliveryId, eventName });
      res.status(204).send("");
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
