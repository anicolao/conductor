import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Gemini Message Bus Events', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('Gemini Message Bus Events', 'Verify that Message Bus events are correctly rendered as debug cards.');

  await page.goto('/debug');

  const sampleLogs = [
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:00.000Z","event":"GEMINI_EVENT","data":{"type":"tool-calls-update","toolCalls":[],"schedulerId":"root","_isMessageBus":true}}',
    '[stderr] [MESSAGE_BUS] publish: {"type":"tool-calls-update","toolCalls":[{"id":"call_1","function":{"name":"read_file"}}],"schedulerId":"root"}',
  ].join('\n');

  await page.fill('textarea', sampleLogs);

  await helper.step('message_bus_events_rendered', {
    description: 'User pastes Message Bus events',
    verifications: [
      {
        spec: 'Both events are rendered as cards',
        check: async () => {
          await expect(page.getByText('Tool Calls Update: root')).toHaveCount(2);
          await expect(page.getByText('🚌 DEBUG')).toHaveCount(2);
        }
      },
      {
        spec: 'Empty tool calls shows status',
        check: async () => {
          await expect(page.getByText('No active tool calls')).toBeVisible();
        }
      },
      {
        spec: 'Active tool call shows function name',
        check: async () => {
          await expect(page.getByText('read_file')).toBeVisible();
        }
      }
    ]
  });

  helper.generateDocs();
});
