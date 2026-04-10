export interface GitHubEvent {
  action?: string;
  issue?: {
    number: number;
    labels: { name: string }[];
    body: string;
    html_url?: string;
    node_id?: string;
  };
  comment?: {
    body: string;
  };
  client_payload?: {
    repository?: string;
    issue_number?: number;
    issue_url?: string;
    issue_node_id?: string;
    project_item_id?: string;
    project_number?: number;
    project_url?: string;
    status?: string;
    persona?: string;
    body?: string;
  };
}

export function extractEventData(event: GitHubEvent, env: NodeJS.ProcessEnv) {
  const repository = event.client_payload?.repository || env.GITHUB_REPOSITORY || '';
  const issueNumber = event.issue?.number ?? event.client_payload?.issue_number;
  const issueUrl = event.issue?.html_url || event.client_payload?.issue_url || '';
  const issueNodeId = event.issue?.node_id || event.client_payload?.issue_node_id || '';
  const labels = event.issue?.labels.map(l => l.name) || [];
  const issueBody = event.issue?.body || event.client_payload?.body || '';
  const commentBody = event.comment?.body || event.client_payload?.body || '';

  return {
    repository,
    issueNumber,
    issueUrl,
    issueNodeId,
    labels,
    issueBody,
    commentBody
  };
}
