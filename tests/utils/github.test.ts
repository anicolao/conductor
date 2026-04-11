import { describe, it, expect } from 'vitest';
import { extractEventData, GitHubEvent } from '../../src/utils/github';

describe('extractEventData', () => {
  it('should extract data from issue event', () => {
    const event: GitHubEvent = {
      issue: {
        number: 123,
        labels: [{ name: 'persona: coder' }],
        body: 'issue body',
        html_url: 'https://github.com/owner/repo/issues/123',
        node_id: 'I_123'
      }
    };
    const env = { GITHUB_REPOSITORY: 'owner/repo' };
    const result = extractEventData(event, env);
    expect(result.repository).toBe('owner/repo');
    expect(result.issueNumber).toBe(123);
    expect(result.issueUrl).toBe('https://github.com/owner/repo/issues/123');
    expect(result.issueNodeId).toBe('I_123');
    expect(result.labels).toContain('persona: coder');
    expect(result.issueBody).toBe('issue body');
  });

  it('should extract data from repository_dispatch event with client_payload', () => {
    const event: GitHubEvent = {
      client_payload: {
        repository: 'other/repo',
        issue_number: 456,
        issue_node_id: 'I_456'
      }
    };
    const env = { GITHUB_REPOSITORY: 'owner/repo' };
    const result = extractEventData(event, env);
    expect(result.repository).toBe('other/repo');
    expect(result.issueNumber).toBe(456);
    expect(result.issueUrl).toBe('');
    expect(result.issueNodeId).toBe('I_456');
    expect(result.labels).toEqual([]);
  });

  it('should fallback to GITHUB_REPOSITORY if repository is missing in client_payload', () => {
    const event: GitHubEvent = {
      client_payload: {
        issue_number: 456
      }
    };
    const env = { GITHUB_REPOSITORY: 'owner/repo' };
    const result = extractEventData(event, env);
    expect(result.repository).toBe('owner/repo');
    expect(result.issueNumber).toBe(456);
  });

  it('should not infer body or commentBody from repository_dispatch payload', () => {
    const event: GitHubEvent = {
      client_payload: {
        repository: 'other/repo',
        issue_number: 789
      }
    };
    const env = { GITHUB_REPOSITORY: 'owner/repo' };
    const result = extractEventData(event, env);
    expect(result.repository).toBe('other/repo');
    expect(result.issueNumber).toBe(789);
    expect(result.issueBody).toBe('');
    expect(result.commentBody).toBe('');
  });
});
