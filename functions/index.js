"use strict";

const crypto = require("crypto");

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");

const githubWebhookSecret = defineSecret("GITHUB_WEBHOOK_SECRET");
const conductorToken = defineSecret("CONDUCTOR_TOKEN");

const TARGET_REPO = "LLM-Orchestration/conductor";
const WORKFLOW_FILE = "conductor.yml";
const TARGET_STATUS = "In Progress";
const TARGET_PROJECT_NUMBER = 1;
const DEFAULT_MAX_RECOVERY_RETRIES = 5;
const RECOVERY_RUN_SUFFIX = "Event: schedule (recover_orphaned_in_progress)";

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

function normalizePersona(persona) {
  return persona === "coder" ? "coder" : "conductor";
}

function parseRunTarget(displayTitle) {
  if (typeof displayTitle !== "string") {
    return null;
  }

  const match = displayTitle.match(/^Conductor \[(.+)\] Issue #(\d+)\b/);
  if (!match) {
    return null;
  }

  return {
    repository: match[1],
    issueNumber: Number(match[2])
  };
}

function isRecoveryRun(run) {
  return typeof run.display_title === "string" && run.display_title.includes(RECOVERY_RUN_SUFFIX);
}

function hasActiveRun(item, runs) {
  return runs.some(run => {
    if (run.status === "completed") {
      return false;
    }

    const target = parseRunTarget(run.display_title);
    return target?.repository === item.repository && target.issueNumber === item.issueNumber;
  });
}

function countRecoveryAttempts(item, runs) {
  return runs.filter(run => {
    if (!isRecoveryRun(run)) {
      return false;
    }

    const target = parseRunTarget(run.display_title);
    return target?.repository === item.repository && target.issueNumber === item.issueNumber;
  }).length;
}

function findOrphanedItems(items, runs) {
  return items.filter(item => item.status === TARGET_STATUS && !hasActiveRun(item, runs));
}

async function loadProjectItems(token) {
  const query = `
    query ProjectItems($org: String!, $number: Int!, $after: String) {
      organization(login: $org) {
        projectV2(number: $number) {
          url
          items(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
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
              content {
                ... on Issue {
                  id
                  number
                  repository {
                    nameWithOwner
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const items = [];
  let after = null;

  while (true) {
    const data = await githubGraphql(query, {
      org: "LLM-Orchestration",
      number: TARGET_PROJECT_NUMBER,
      after
    }, token);

    const project = data?.organization?.projectV2 ?? null;
    if (!project) {
      throw new Error(`Project LLM-Orchestration#${TARGET_PROJECT_NUMBER} was not found`);
    }

    for (const node of project.items.nodes) {
      const repository = node.content?.repository?.nameWithOwner;
      const issueNumber = node.content?.number;
      const issueNodeId = node.content?.id;
      const status = node.status?.name;
      if (!repository || !issueNumber || !issueNodeId || !status) {
        continue;
      }

      items.push({
        repository,
        issueNumber,
        issueNodeId,
        projectNumber: TARGET_PROJECT_NUMBER,
        projectUrl: project.url,
        status,
        persona: node.persona?.name === "coder" || node.persona?.name === "conductor" ? node.persona.name : null
      });
    }

    if (!project.items.pageInfo.hasNextPage) {
      break;
    }
    after = project.items.pageInfo.endCursor;
  }

  return items;
}

async function loadWorkflowRuns(token) {
  const data = await githubRest(`/repos/${TARGET_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=100`, token);
  return Array.isArray(data?.workflow_runs) ? data.workflow_runs : [];
}

async function recoverOrphanedItems(token) {
  const [items, runs] = await Promise.all([
    loadProjectItems(token),
    loadWorkflowRuns(token)
  ]);

  const orphanedItems = findOrphanedItems(items, runs);
  logger.info("Cloud scheduler scanned project for orphaned in-progress items", {
    scannedItems: items.length,
    orphanedItems: orphanedItems.length,
    maxRetries: DEFAULT_MAX_RECOVERY_RETRIES
  });

  for (const item of orphanedItems) {
    const retries = countRecoveryAttempts(item, runs);
    if (retries >= DEFAULT_MAX_RECOVERY_RETRIES) {
      logger.info("Skipping orphan recovery because retry budget is exhausted", {
        repository: item.repository,
        issueNumber: item.issueNumber,
        retries,
        maxRetries: DEFAULT_MAX_RECOVERY_RETRIES
      });
      continue;
    }

    await dispatchProjectActivation(
      item.repository,
      item.issueNumber,
      token,
      "schedule",
      "recover_orphaned_in_progress",
      item.issueNodeId,
      item.projectNumber,
      item.projectUrl,
      normalizePersona(item.persona)
    );

    logger.info("Cloud scheduler re-dispatched orphaned in-progress item", {
      repository: item.repository,
      issueNumber: item.issueNumber,
      persona: normalizePersona(item.persona),
      retry: retries + 1
    });
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

exports.recoverOrphanedInProgress = onSchedule(
  {
    region: "us-central1",
    schedule: "3-58/5 * * * *",
    timeZone: "UTC",
    secrets: [conductorToken]
  },
  async () => {
    try {
      await recoverOrphanedItems(conductorToken.value());
    } catch (error) {
      logger.error("Scheduled orphan recovery failed", {
        message: error.message,
        details: error.details || null
      });
      throw error;
    }
  }
);
