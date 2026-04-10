export interface GitHubEvent {
  action?: string;
  issue?: {
    number: number;
    labels: { name: string }[];
    body: string;
  };
  comment?: {
    body: string;
  };
  client_payload?: {
    repository?: string;
    issue_number?: number;
    project_number?: number;
    project_url?: string;
    status?: string;
  };
}

export function extractEventData(event: GitHubEvent, env: NodeJS.ProcessEnv) {
  const repository = event.client_payload?.repository || env.GITHUB_REPOSITORY || '';
  const issueNumber = event.issue?.number ?? event.client_payload?.issue_number;
  const labels = event.issue?.labels.map(l => l.name) || [];
  const issueBody = event.issue?.body || '';
  const commentBody = event.comment?.body || '';

  return {
    repository,
    issueNumber,
    labels,
    issueBody,
    commentBody
  };
}
