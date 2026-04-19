// @ts-check
"use strict";

/**
 * @param {unknown} persona
 * @returns {"conductor" | "coder" | undefined}
 */
function normalizeDispatchPersona(persona) {
  return persona === "coder" || persona === "conductor" ? persona : undefined;
}

/**
 * @param {{
 *   repository: string,
 *   issueNumber: number,
 *   issueNodeId?: string | null,
 *   projectNumber?: number | null,
 *   projectUrl?: string | null,
 *   persona?: unknown,
 *   eventName?: string | null,
 *   action?: string | null
 * }} args
 */
function buildProjectDispatchPayload(args) {
  const clientPayload = {
    repository: args.repository,
    issue_number: args.issueNumber,
    issue_node_id: args.issueNodeId ?? null,
    project_number: args.projectNumber ?? null,
    project_url: args.projectUrl ?? null,
    event_name: args.eventName ?? null,
    action: args.action ?? null
  };

  const persona = normalizeDispatchPersona(args.persona);
  if (persona) {
    clientPayload.persona = persona;
  }

  return {
    event_type: "project_in_progress",
    client_payload: clientPayload
  };
}

module.exports = {
  buildProjectDispatchPayload,
  normalizeDispatchPersona
};
