import { describe, it, expect } from 'vitest';
import { extractEventData, GitHubEvent, extractMediaUrls, collectAllMediaUrls, injectMediaPaths } from '../../src/utils/github';

describe('injectMediaPaths', () => {
  it('should inject paths after URLs', () => {
    const text = 'Check this: https://github.com/user-attachments/assets/1\nAnd this: https://github.com/user-attachments/assets/2';
    const urlToPath = new Map([
      ['https://github.com/user-attachments/assets/1', '/tmp/1.png'],
      ['https://github.com/user-attachments/assets/2', '/tmp/2.png']
    ]);
    const result = injectMediaPaths(text, urlToPath);
    expect(result).toBe('Check this: https://github.com/user-attachments/assets/1 <!-- CONDUCTOR_MEDIA_PATH: /tmp/1.png -->\nAnd this: https://github.com/user-attachments/assets/2 <!-- CONDUCTOR_MEDIA_PATH: /tmp/2.png -->');
  });

  it('should handle duplicate URLs in text', () => {
    const text = 'URL: https://github.com/user-attachments/assets/1 and again: https://github.com/user-attachments/assets/1';
    const urlToPath = new Map([
      ['https://github.com/user-attachments/assets/1', '/tmp/1.png']
    ]);
    const result = injectMediaPaths(text, urlToPath);
    expect(result).toBe('URL: https://github.com/user-attachments/assets/1 <!-- CONDUCTOR_MEDIA_PATH: /tmp/1.png --> and again: https://github.com/user-attachments/assets/1 <!-- CONDUCTOR_MEDIA_PATH: /tmp/1.png -->');
  });

  it('should return original text if no matches', () => {
    const text = 'No URLs here';
    const urlToPath = new Map([['https://example.com', '/tmp/ex.png']]);
    const result = injectMediaPaths(text, urlToPath);
    expect(result).toBe(text);
  });
});

describe('extractMediaUrls', () => {
  it('should extract multiple URLs from text', () => {
    const text = 'Here are some images: https://github.com/user-attachments/assets/3c27f0cf-ed52-489a-bb2f-25f1f06891c8 and https://github.com/user-attachments/assets/12345678-1234-1234-1234-1234567890ab';
    const result = extractMediaUrls(text);
    expect(result).toEqual([
      'https://github.com/user-attachments/assets/3c27f0cf-ed52-489a-bb2f-25f1f06891c8',
      'https://github.com/user-attachments/assets/12345678-1234-1234-1234-1234567890ab'
    ]);
  });

  it('should de-duplicate URLs', () => {
    const text = 'Duplicate: https://github.com/user-attachments/assets/3c27f0cf-ed52-489a-bb2f-25f1f06891c8 and https://github.com/user-attachments/assets/3c27f0cf-ed52-489a-bb2f-25f1f06891c8';
    const result = extractMediaUrls(text);
    expect(result).toEqual(['https://github.com/user-attachments/assets/3c27f0cf-ed52-489a-bb2f-25f1f06891c8']);
  });

  it('should return empty array if no URLs found', () => {
    const text = 'No URLs here';
    const result = extractMediaUrls(text);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty or null input', () => {
    expect(extractMediaUrls('')).toEqual([]);
    expect(extractMediaUrls(null as unknown as string)).toEqual([]);
  });
});

describe('collectAllMediaUrls', () => {
  it('should collect unique URLs from issue body and latest comment', () => {
    const issueBody = 'Issue: https://github.com/user-attachments/assets/1';
    const latestComment = 'Latest: https://github.com/user-attachments/assets/2';

    const result = collectAllMediaUrls(issueBody, latestComment);
    expect(result.sort()).toEqual([
      'https://github.com/user-attachments/assets/1',
      'https://github.com/user-attachments/assets/2'
    ].sort());
  });

  it('should handle empty sources', () => {
    const result = collectAllMediaUrls('', '');
    expect(result).toEqual([]);
  });
});

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

  it('should extract commentUrl from issue_comment event', () => {
    const event: GitHubEvent = {
      issue: {
        number: 123,
        labels: [],
        body: 'issue body',
        html_url: 'https://github.com/owner/repo/issues/123'
      },
      comment: {
        body: 'comment body',
        html_url: 'https://github.com/owner/repo/issues/123#issuecomment-789'
      }
    };
    const result = extractEventData(event, {});
    expect(result.commentBody).toBe('comment body');
    expect(result.commentUrl).toBe('https://github.com/owner/repo/issues/123#issuecomment-789');
  });

  it('should extract commentUrl from client_payload', () => {
    const event: GitHubEvent = {
      client_payload: {
        last_comment_url: 'https://github.com/owner/repo/issues/123#issuecomment-456'
      }
    };
    const result = extractEventData(event, {});
    expect(result.commentUrl).toBe('https://github.com/owner/repo/issues/123#issuecomment-456');
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
