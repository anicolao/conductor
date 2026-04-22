// @ts-check

/**
 * @param {unknown} persona
 * @returns {"conductor" | "coder" | undefined}
 */
function normalizeDispatchPersona(persona) {
	return persona === "coder" || persona === "conductor" ? persona : undefined;
}

/**
 * Justification for buildProjectDispatchPayload fields:
 * - repository: REQUIRED. Identifies the target repository for the orchestrated task.
 * - issueNumber: REQUIRED. Identifies the specific issue being addressed.
 * - issueNodeId: REQUIRED. Needed for GraphQL mutations in downstream agents.
 * - projectNumber: REQUIRED. Identifies the project board context.
 * - projectUrl: REQUIRED. Used to determine the project owner and for referencing.
 * - eventName: REQUIRED. Identifies the trigger event source.
 * - action: REQUIRED. Identifies the specific action within the event.
 * - persona: OPTIONAL. May be unset in the project board; omitted if null/invalid to allow receiver defaults.
 *
 * @param {{
 *   repository: string,
 *   issueNumber: number,
 *   issueNodeId: string,
 *   projectNumber: number,
 *   projectUrl: string,
 *   persona?: unknown,
 *   eventName: string,
 *   action: string
 * }} args
 */
function buildProjectDispatchPayload(args) {
	const clientPayload = {
		repository: args.repository,
		issue_number: args.issueNumber,
		issue_node_id: args.issueNodeId,
		project_number: args.projectNumber,
		project_url: args.projectUrl,
		event_name: args.eventName,
		action: args.action,
	};

	const persona = normalizeDispatchPersona(args.persona);
	if (persona) {
		clientPayload.persona = persona;
	}

	return {
		event_type: "project_in_progress",
		client_payload: clientPayload,
	};
}

module.exports = {
	buildProjectDispatchPayload,
	normalizeDispatchPersona,
};
