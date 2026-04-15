import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Run Details Route', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('Run Details Route', 'Verify that the run details route fetches and displays conductor events.');

  const runId = '123456';
  const jobId = 789;

  // Mock GitHub Run Details API
  await page.route(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${runId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: parseInt(runId),
        display_title: 'Conductor [LLM-Orchestration/conductor] Issue #88',
        status: 'completed',
        conclusion: 'success',
        html_url: `https://github.com/LLM-Orchestration/conductor/actions/runs/${runId}`
      }),
    });
  });

  // Mock GitHub Jobs API
  await page.route(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${runId}/jobs`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jobs: [
          { id: jobId, name: 'run-conductor' },
          { id: 999, name: 'other-job' }
        ]
      }),
    });
  });

  // Mock GitHub Logs API
  await page.route(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/jobs/${jobId}/logs`, async (route) => {
    const logs = `
Some random log line
2026-04-14T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-14T12:00:00Z","event":"START","data":{"msg":"Starting workflow"}}
2026-04-14T12:00:05Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-14T12:00:05Z","event":"STDOUT","data":"Compiling source code..."}
2026-04-14T12:00:10Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-14T12:00:10Z","event":"STDERR","data":"Warning: low disk space"}
2026-04-14T12:01:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-14T12:01:00Z","event":"TASK","persona":"coder","data":{"task":"Implement feature"}}
    `;
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: logs,
    });
  });

  // Set token in sessionStorage and navigate
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('github_access_token', 'test_access_token');
  });
  await page.goto(`/run?id=${runId}`);
  await helper.step('run_details_loaded', {
    description: 'Run details page loaded with events',
    verifications: [
      { 
        spec: 'Back to Dashboard link is visible', 
        check: async () => expect(page.getByRole('link', { name: '← Back to Dashboard' })).toBeVisible() 
      },
      { 
        spec: 'Title is correct', 
        check: async () => expect(page.getByRole('heading', { name: `Run Details: Conductor [LLM-Orchestration/conductor] Issue #88` })).toBeVisible() 
      },
      { 
        spec: 'Status badge is visible', 
        check: async () => expect(page.locator('.status-badge.success')).toContainText('success') 
      },
      { 
        spec: 'Drill down link is correct', 
        check: async () => expect(page.getByRole('link', { name: 'View on GitHub (Drill Down) ↗' })).toHaveAttribute('href', `https://github.com/LLM-Orchestration/conductor/actions/runs/${runId}`) 
      }
    ]
  });

  await helper.step('timeline_visible', {
    description: 'Event timeline is displayed with parsed events',
    verifications: [
      { 
        spec: 'Terminal window shows STDOUT and STDERR', 
        check: async () => {
          const terminal = page.locator('.terminal-body');
          await expect(terminal.locator('.terminal-line.stdout')).toContainText('Compiling source code...');
          await expect(terminal.locator('.terminal-line.stderr')).toContainText('Warning: low disk space');
        }
      },
      { 
        spec: 'Other events are displayed below terminal', 
        check: async () => {
          const event = page.locator('.event-card').first();
          await expect(event.locator('.event-type')).toHaveText('START');
          await expect(event.locator('.event-body')).toContainText('Starting workflow');
        }
      },
      { 
        spec: 'Task event is displayed with persona', 
        check: async () => {
          const event = page.locator('.event-card').nth(1);
          await expect(event.locator('.event-type')).toHaveText('TASK');
          await expect(event.locator('.persona')).toHaveText('(coder)');
          await expect(event.locator('.event-body')).toContainText('Implement feature');
        }
      }
    ]
  });

  helper.generateDocs();
});
