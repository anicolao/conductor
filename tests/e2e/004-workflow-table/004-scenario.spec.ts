import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Workflow Table Display', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('Workflow Table Display', 'Verify that the landing page shows a table of recent workflow runs when logged in.');

  const mockWorkflowRuns = [
    {
      id: 123456789,
      name: 'Conductor Run',
      display_title: 'Conductor [LLM-Orchestration/conductor] Issue #83',
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/LLM-Orchestration/conductor/actions/runs/123456789',
      created_at: '2026-04-14T12:00:00Z',
      updated_at: '2026-04-14T12:05:00Z',
      head_branch: 'feature/landing-page-workflow-table'
    },
    {
      id: 987654321,
      name: 'Conductor Run',
      display_title: 'Conductor [some-org/another-repo] Issue #42',
      status: 'in_progress',
      conclusion: null,
      html_url: 'https://github.com/some-org/another-repo/actions/runs/987654321',
      created_at: '2026-04-14T11:00:00Z',
      updated_at: '2026-04-14T11:00:00Z',
      head_branch: 'main'
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
        total_count: 2,
        workflow_runs: mockWorkflowRuns
      }),
    });
  });

  // Mock GitHub OAuth Authorize redirect
  await page.route('https://github.com/login/oauth/authorize*', async (route) => {
    await page.goto('/auth/callback?code=test_code');
    await route.abort();
  });

  await page.goto('/');

  await helper.step('landing_page_loaded', {
    description: 'Landing page loaded with Login button',
    verifications: [
      { spec: 'Login button is visible', check: async () => expect(page.getByRole('button', { name: 'Login with GitHub' })).toBeVisible() }
    ]
  });

  // Click login
  await page.getByRole('button', { name: 'Login with GitHub' }).click();

  // Wait for the table to load
  await expect(page.getByRole('heading', { name: 'Recent Workflows' })).toBeVisible();

  await helper.step('workflow_table_visible', {
    description: 'Workflow table is displayed with correct data',
    verifications: [
      { 
        spec: 'Table headers are correct', 
        check: async () => {
          await expect(page.getByRole('columnheader', { name: 'Repository' })).toBeVisible();
          await expect(page.getByRole('columnheader', { name: 'Issue' })).toBeVisible();
          await expect(page.getByRole('columnheader', { name: 'Workflow Run' })).toBeVisible();
          await expect(page.getByRole('columnheader', { name: 'Timestamp' })).toBeVisible();
        }
      },
      {
        spec: 'First row data is correct',
        check: async () => {
          const row = page.getByRole('row').filter({ hasText: 'LLM-Orchestration/conductor' });
          await expect(row.getByRole('link', { name: 'LLM-Orchestration/conductor' })).toHaveAttribute('href', 'https://github.com/LLM-Orchestration/conductor');
          await expect(row.getByRole('link', { name: '#83' })).toHaveAttribute('href', 'https://github.com/LLM-Orchestration/conductor/issues/83');
          await expect(row.getByRole('link', { name: 'View Run' })).toHaveAttribute('href', 'https://github.com/LLM-Orchestration/conductor/actions/runs/123456789');
        }
      },
      {
        spec: 'Second row data is correct',
        check: async () => {
          const row = page.getByRole('row').filter({ hasText: 'some-org/another-repo' });
          await expect(row.getByRole('link', { name: 'some-org/another-repo' })).toHaveAttribute('href', 'https://github.com/some-org/another-repo');
          await expect(row.getByRole('link', { name: '#42' })).toHaveAttribute('href', 'https://github.com/some-org/another-repo/issues/42');
          await expect(row.getByRole('link', { name: 'View Run' })).toHaveAttribute('href', 'https://github.com/some-org/another-repo/actions/runs/987654321');
        }
      }
    ]
  });

  helper.generateDocs();
});
