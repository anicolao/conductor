import { spawnSync } from 'child_process';
import * as path from 'path';

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

/**
 * Downloads a media file from a URL to a local path using curl.
 */
export async function downloadMedia(url: string, destPath: string): Promise<void> {
  const result = spawnSync('curl', ['-L', '-s', '-o', destPath, url]);
  if (result.status !== 0) {
    throw new Error(`Failed to download media from ${url}: ${result.stderr?.toString() || 'Unknown error'}`);
  }
}

/**
 * Injects local media paths into text after their corresponding URLs.
 */
export function injectMediaPaths(text: string, urlToPath: Map<string, string>): string {
  if (!text) return '';
  let updatedText = text;
  for (const [url, localPath] of urlToPath.entries()) {
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedUrl, 'g');
    updatedText = updatedText.replace(regex, `${url}\n@${localPath}`);
  }
  return updatedText;
}

/**
 * Identifies if a comment was made by a persona (conductor, coder, automation).
 * Persona comments always start with "I am the **persona**".
 */
export function isPersonaComment(body: string): boolean {
  return /^I am the \*\*(conductor|coder|automation|human)\*\*/.test(body.trim());
}
