import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Run Details Streaming Logs', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('Run Details Streaming Logs', 'Verify that the run details route polls for logs and updates the timeline.');

  const runId = 'streaming-123';
  const jobId = 456;

  let logCalls = 0;

  // Mock GitHub Run Details API - initially in_progress
  await page.route(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${runId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: parseInt(runId),
        display_title: 'Streaming Run',
        status: logCalls < 2 ? 'in_progress' : 'completed',
        conclusion: logCalls < 2 ? null : 'success',
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
          { 
            id: jobId, 
            name: 'run-conductor', 
            status: 'in_progress',
            steps: [
              { name: 'Set up job', status: 'completed', conclusion: 'success', started_at: '2026-04-15T12:00:00Z' },
              { name: 'Run Conductor', status: 'in_progress', conclusion: null, started_at: '2026-04-15T12:00:05Z' }
            ]
          }
        ]
      }),
    });
  });

  // Mock GitHub Logs API - dynamic response
  await page.route(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/jobs/${jobId}/logs`, async (route) => {
    logCalls++;
    if (logCalls === 1) {
      // First call: 404
      await route.fulfill({ status: 404 });
    } else if (logCalls === 2) {
      // Second call: partial logs
      const logs = `2026-04-15T12:00:10Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:10Z","event":"session_start","persona":"conductor","data":{"branch":"feat/streaming"}}`;
      await route.fulfill({ status: 200, contentType: 'text/plain', body: logs });
    } else {
      // Third call and beyond: full logs
      const logs = `2026-04-15T12:00:10Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:10Z","event":"session_start","persona":"conductor","data":{"branch":"feat/streaming"}}
2026-04-15T12:00:20Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:20Z","event":"session_end","data":{"status":"success"}}`;
      await route.fulfill({ status: 200, contentType: 'text/plain', body: logs });
    }
  });

  // Set token in sessionStorage and navigate
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('github_access_token', 'test_access_token');
  });
  await page.goto(`/run?id=${runId}`);

  await helper.step('initial_load_404', {
    description: 'Initially shows steps when logs are 404',
    verifications: [
      { 
        spec: 'Fallback steps are visible', 
        check: async () => {
          await expect(page.locator('.event-card.task-card')).toHaveCount(2);
          await expect(page.locator('.event-card.task-card').first()).toContainText('Set up job: completed');
        }
      },
      {
        spec: 'Live indicator is visible',
        check: async () => expect(page.locator('.streaming-indicator')).toBeVisible()
      },
      {
        spec: 'Waiting message is visible',
        check: async () => expect(page.locator('.status.small')).toContainText('Waiting for logs to stream...')
      }
    ]
  });

  // Wait for polling (5 seconds interval in code, but we can just wait for the state change)
  await helper.step('second_load_partial', {
    description: 'Timeline updates when partial logs are available',
    verifications: [
      { 
        spec: 'Session start event is visible', 
        check: async () => {
          await expect(page.locator('.event-card.session-start')).toBeVisible({ timeout: 10000 });
          await expect(page.locator('.event-card.task-card')).toHaveCount(0);
        }
      }
    ]
  });

  await helper.step('final_load_complete', {
    description: 'Timeline updates when logs are complete and polling stops',
    verifications: [
      { 
        spec: 'Session end event is visible', 
        check: async () => {
          await expect(page.locator('.event-card.session-end')).toBeVisible({ timeout: 10000 });
        }
      },
      {
        spec: 'Live indicator disappears after completion',
        check: async () => await expect(page.locator('.streaming-indicator')).not.toBeVisible({ timeout: 10000 })
      }
    ]
  });

  helper.generateDocs();
});
