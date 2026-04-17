import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Gemini JSON Mode Observability', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('Gemini JSON Mode Observability', 'Verify that Gemini JSON events are correctly aggregated and rendered.');

  await page.goto('/debug');

  await helper.step('debug_page_loaded', {
    description: 'User navigates to the debug page',
    verifications: [
      {
        spec: 'Heading is visible',
        check: async () => {
          await expect(page.getByRole('heading', { name: 'Conductor Log Parser Debug' })).toBeVisible();
        }
      }
    ]
  });

  const sampleLogs = [
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:00.000Z","event":"GEMINI_EVENT","data":{"type":"init","sessionId":"s1","model":"gemini-1.5-pro"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:01.000Z","event":"GEMINI_EVENT","data":{"type":"message","role":"assistant","content":"I will help "}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:02.000Z","event":"GEMINI_EVENT","data":{"type":"message","role":"assistant","content":"you with that."}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:03.000Z","event":"GEMINI_EVENT","data":{"type":"tool_use","tool":"read_file","args":{"path":"README.md"}}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:04.000Z","event":"GEMINI_EVENT","data":{"type":"tool_result","tool":"read_file","result":"File content..."}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:05.000Z","event":"GEMINI_EVENT","data":{"type":"result","response":"Finished.","stats":{"tokens":{"total":100,"prompt":40,"completion":60},"latency":500}}}'
  ].join('\n');

  await page.fill('textarea', sampleLogs);

  await helper.step('gemini_events_rendered', {
    description: 'User pastes Gemini JSON logs',
    verifications: [
      {
        spec: 'Gemini Initialized is visible',
        check: async () => {
          await expect(page.getByText('Gemini Initialized')).toBeVisible();
          await expect(page.getByText('s1')).toBeVisible();
          await expect(page.getByText('gemini-1.5-pro')).toBeVisible();
        }
      },
      {
        spec: 'Assistant message is aggregated',
        check: async () => {
          await expect(page.getByText('I will help you with that.')).toBeVisible();
        }
      },
      {
        spec: 'Tool use is visible',
        check: async () => {
          await expect(page.getByText('Tool Use: read_file')).toBeVisible();
          await expect(page.getByText('"path": "README.md"')).toBeVisible();
        }
      },
      {
        spec: 'Tool result is visible',
        check: async () => {
          await expect(page.getByText('Tool Result: read_file')).toBeVisible();
          await expect(page.getByText('File content...')).toBeVisible();
        }
      },
      {
        spec: 'Final result is visible with stats',
        check: async () => {
          await expect(page.getByText('Gemini Result')).toBeVisible();
          await expect(page.getByText('Finished.')).toBeVisible();
          await expect(page.getByText('100 (P: 40, C: 60)')).toBeVisible();
          await expect(page.getByText('500ms')).toBeVisible();
        }
      }
    ]
  });

  helper.generateDocs();
});
