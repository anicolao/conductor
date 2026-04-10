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
        issue_url: 'https://github.com/other/repo/issues/456',
        issue_node_id: 'I_456',
        status: 'In Progress'
      }
    };
    const env = { GITHUB_REPOSITORY: 'owner/repo' };
    const result = extractEventData(event, env);
    expect(result.repository).toBe('other/repo');
    expect(result.issueNumber).toBe(456);
    expect(result.issueUrl).toBe('https://github.com/other/repo/issues/456');
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

  it('should extract body and commentBody from enriched repository_dispatch', () => {
    const event: GitHubEvent = {
      client_payload: {
        repository: 'other/repo',
        issue_number: 789,
        body: 'comment from payload'
      }
    };
    const env = { GITHUB_REPOSITORY: 'owner/repo' };
    const result = extractEventData(event, env);
    expect(result.repository).toBe('other/repo');
    expect(result.issueNumber).toBe(789);
    expect(result.issueBody).toBe('comment from payload'); // issueBody gets it as fallback
    expect(result.commentBody).toBe('comment from payload');
  });

  it('should extract body into both if only body is present', () => {
    const event: GitHubEvent = {
      client_payload: {
        repository: 'other/repo',
        issue_number: 789,
        body: 'body from payload'
      }
    };
    const env = { GITHUB_REPOSITORY: 'owner/repo' };
    const result = extractEventData(event, env);
    expect(result.issueBody).toBe('body from payload');
    expect(result.commentBody).toBe('body from payload');
  });
});
