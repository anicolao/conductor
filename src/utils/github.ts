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
    html_url?: string;
  };
  client_payload?: {
    repository?: string;
    issue_number?: number;
    issue_node_id?: string;
    project_item_id?: string;
    project_number?: number;
    project_url?: string;
    persona?: string;
    event_name?: string;
    action?: string;
    last_comment_url?: string;
  };
}

export function extractEventData(event: GitHubEvent, env: NodeJS.ProcessEnv) {
  const repository = event.client_payload?.repository || env.GITHUB_REPOSITORY || '';
  const issueNumber = event.issue?.number ?? event.client_payload?.issue_number;
  const issueUrl = event.issue?.html_url || '';
  const issueNodeId = event.issue?.node_id || event.client_payload?.issue_node_id || '';
  const labels = event.issue?.labels?.map(l => l.name) || [];
  const issueBody = event.issue?.body || '';
  const commentBody = event.comment?.body || '';
  const commentUrl = event.comment?.html_url || event.client_payload?.last_comment_url || '';
  const projectNumber = event.client_payload?.project_number;
  const projectUrl = event.client_payload?.project_url;
  const eventName = event.client_payload?.event_name || env.GITHUB_EVENT_NAME || '';
  const action = event.client_payload?.action || event.action || '';

  return {
    repository,
    issueNumber,
    issueUrl,
    issueNodeId,
    labels,
    issueBody,
    commentBody,
    commentUrl,
    projectNumber,
    projectUrl,
    eventName,
    action
  };
}

/**
 * Extracts GitHub user-attachment URLs from a given text.
 * @param text The text to scan for URLs.
 * @returns An array of unique media URLs.
 */
export function extractMediaUrls(text: string): string[] {
  if (!text) return [];
  const regex = /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-fA-F-]+/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return [...new Set(matches)];
}

/**
 * Collects all unique media URLs from issue body and latest comment.
 */
export function collectAllMediaUrls(
  issueBody: string,
  latestCommentBody: string
): string[] {
  const mediaUrls = new Set<string>([
    ...extractMediaUrls(issueBody),
    ...extractMediaUrls(latestCommentBody)
  ]);
  return [...mediaUrls];
}
