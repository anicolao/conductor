import { describe, it, expect } from 'vitest';
import { extractEventData, GitHubEvent } from '../../src/utils/github';

describe('extractEventData', () => {
  it('should extract data from issue event', () => {
    const event: GitHubEvent = {
      issue: {
        number: 123,
        labels: [{ name: 'persona: coder' }],
        body: 'issue body'
      }
    };
    const env = { GITHUB_REPOSITORY: 'owner/repo' };
    const result = extractEventData(event, env);
    expect(result.repository).toBe('owner/repo');
    expect(result.issueNumber).toBe(123);
    expect(result.labels).toContain('persona: coder');
    expect(result.issueBody).toBe('issue body');
  });

  it('should extract data from repository_dispatch event with client_payload', () => {
    const event: GitHubEvent = {
      client_payload: {
        repository: 'other/repo',
        issue_number: 456,
        status: 'In Progress'
      }
    };
    const env = { GITHUB_REPOSITORY: 'owner/repo' };
    const result = extractEventData(event, env);
    expect(result.repository).toBe('other/repo');
    expect(result.issueNumber).toBe(456);
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
});
