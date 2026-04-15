import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('PR Lookup by Branch Label', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('PR Lookup by Branch Label', 'Verify that the PR is correctly identified using the branch: label on the issue.');

  const mockWorkflowRuns = [
    {
      id: 111222333,
      name: 'Conductor Run',
      display_title: 'Conductor [LLM-Orchestration/conductor] Issue #94',
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/LLM-Orchestration/conductor/actions/runs/111222333',
      created_at: '2026-04-15T10:00:00Z',
      updated_at: '2026-04-15T10:05:00Z',
      head_branch: 'main' // Incorrect branch for the task, but common for repository_dispatch
    }
  ];

  // Mock Firebase Function for OAuth exchange
  await page.route('**/githubOAuthExchange', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ access_token: 'test_access_token' }),
    });
  });

  // Mock GitHub User API
  await page.route('https://api.github.com/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        login: 'testuser',
        avatar_url: 'https://github.com/testuser.png',
      }),
    });
  });

  // Mock GitHub Repo API
  await page.route('https://api.github.com/repos/LLM-Orchestration/conductor', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'conductor',
        full_name: 'LLM-Orchestration/conductor',
      }),
    });
  });

  // Mock GitHub Workflow Runs API
  await page.route('https://api.github.com/repos/LLM-Orchestration/conductor/actions/workflows/conductor.yml/runs?per_page=50', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_count: 1,
        workflow_runs: mockWorkflowRuns
      }),
    });
  });

  // Mock GitHub Issues API with labels
  await page.route('https://api.github.com/repos/LLM-Orchestration/conductor/issues/94', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        number: 94,
        title: 'Fix PR column',
        html_url: 'https://github.com/LLM-Orchestration/conductor/issues/94',
        labels: [
          { name: 'persona: coder' },
          { name: 'branch: issue-94' }
        ]
        // No pull_request field here to force lookup by branch
      }),
    });
  });

  // Mock GitHub Pulls API lookup by branch
  await page.route('https://api.github.com/repos/LLM-Orchestration/conductor/pulls?head=LLM-Orchestration:issue-94&state=all', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          number: 95,
          html_url: 'https://github.com/LLM-Orchestration/conductor/pull/95'
        }
      ]),
    });
  });

  // Mock GitHub OAuth Authorize redirect
  await page.route('https://github.com/login/oauth/authorize*', async (route) => {
    await page.goto('/auth/callback?code=test_code');
    await route.abort();
  });

  await page.goto('/');

  // Click login
  await page.getByRole('button', { name: 'Login with GitHub' }).click();

  // Wait for the table to load
  await expect(page.getByRole('heading', { name: 'Recent Workflows' })).toBeVisible();

  await helper.step('pr_link_visible_by_label', {
    description: 'PR link is visible based on the branch: label',
    verifications: [
      {
        spec: 'PR link points to the correct PR found via branch label',
        check: async () => {
          const row = page.getByRole('row').filter({ hasText: 'LLM-Orchestration/conductor' });
          await expect(row.getByRole('link', { name: 'PR #95' })).toHaveAttribute('href', 'https://github.com/LLM-Orchestration/conductor/pull/95');
        }
      }
    ]
  });

  helper.generateDocs();
});

test('PR Lookup by Search Fallback', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('PR Lookup by Search Fallback', 'Verify that the PR is correctly identified using the Search API fallback when branch-based lookup fails.');

  const mockWorkflowRuns = [
    {
      id: 444555666,
      name: 'Conductor Run',
      display_title: 'Conductor [LLM-Orchestration/conductor] Issue #123',
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/LLM-Orchestration/conductor/actions/runs/444555666',
      created_at: '2026-04-15T11:00:00Z',
      updated_at: '2026-04-15T11:05:00Z',
      head_branch: 'unknown-branch'
    }
  ];

  // Mock Firebase Function for OAuth exchange
  await page.route('**/githubOAuthExchange', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ access_token: 'test_access_token' }),
    });
  });

  // Mock GitHub User API
  await page.route('https://api.github.com/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        login: 'testuser',
        avatar_url: 'https://github.com/testuser.png',
      }),
    });
  });

  // Mock GitHub Repo API
  await page.route('https://api.github.com/repos/LLM-Orchestration/conductor', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'conductor',
        full_name: 'LLM-Orchestration/conductor',
      }),
    });
  });

  // Mock GitHub Workflow Runs API
  await page.route('https://api.github.com/repos/LLM-Orchestration/conductor/actions/workflows/conductor.yml/runs?per_page=50', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_count: 1,
        workflow_runs: mockWorkflowRuns
      }),
    });
  });

  // Mock GitHub Issues API
  await page.route('https://api.github.com/repos/LLM-Orchestration/conductor/issues/123', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        number: 123,
        title: 'Search fallback issue',
        html_url: 'https://github.com/LLM-Orchestration/conductor/issues/123',
        labels: []
      }),
    });
  });

  // Mock GitHub Pulls API lookup by branch (fail)
  await page.route('https://api.github.com/repos/LLM-Orchestration/conductor/pulls?head=LLM-Orchestration:unknown-branch&state=all', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // Mock GitHub Search API fallback
  await page.route('https://api.github.com/search/issues?q=repo:LLM-Orchestration/conductor+type:pr+123', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            number: 124,
            html_url: 'https://github.com/LLM-Orchestration/conductor/pull/124'
          }
        ]
      }),
    });
  });

  // Mock GitHub OAuth Authorize redirect
  await page.route('https://github.com/login/oauth/authorize*', async (route) => {
    await page.goto('/auth/callback?code=test_code');
    await route.abort();
  });

  await page.goto('/');

  // Click login
  await page.getByRole('button', { name: 'Login with GitHub' }).click();

  // Wait for the table to load
  await expect(page.getByRole('heading', { name: 'Recent Workflows' })).toBeVisible();

  await helper.step('pr_link_visible_by_search', {
    description: 'PR link is visible based on the Search API fallback',
    verifications: [
      {
        spec: 'PR link points to the correct PR found via Search API',
        check: async () => {
          const row = page.getByRole('row').filter({ hasText: 'LLM-Orchestration/conductor' });
          await expect(row.getByRole('link', { name: 'PR #124' })).toHaveAttribute('href', 'https://github.com/LLM-Orchestration/conductor/pull/124');
        }
      }
    ]
  });

  helper.generateDocs();
});
