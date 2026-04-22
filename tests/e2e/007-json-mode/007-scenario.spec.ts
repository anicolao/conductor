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
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:00.000Z","event":"GEMINI_EVENT","data":{"type":"init","session_id":"s1","model":"gemini-1.5-pro","timestamp":"2026-04-17T12:00:00.000Z"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:01.000Z","event":"GEMINI_EVENT","data":{"type":"message","role":"assistant","content":"I will help ","delta":true,"timestamp":"2026-04-17T12:00:01.000Z"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:02.000Z","event":"GEMINI_EVENT","data":{"type":"message","role":"assistant","content":"you with that.","delta":true,"timestamp":"2026-04-17T12:00:02.000Z"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:03.000Z","event":"GEMINI_EVENT","data":{"type":"tool_use","tool_name":"read_file","tool_id":"call_1","parameters":{"path":"README.md"},"timestamp":"2026-04-17T12:00:03.000Z"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:04.000Z","event":"GEMINI_EVENT","data":{"type":"tool_result","tool_id":"call_1","status":"success","output":"File content...","timestamp":"2026-04-17T12:00:04.000Z"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:04.100Z","event":"GEMINI_EVENT","data":{"type":"tool_use","tool_name":"run_shell_command","tool_id":"call_2","parameters":{"command":"ls"},"timestamp":"2026-04-17T12:00:04.100Z"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:04.200Z","event":"GEMINI_EVENT","data":{"type":"tool_result","tool_id":"call_2","status":"success","output":"Done.","timestamp":"2026-04-17T12:00:04.200Z"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:04.550Z","event":"GEMINI_EVENT","data":{"type":"tool_use","tool_name":"list_directory","tool_id":"1o6dfh4u","parameters":{"dir_path":"observability-ui/src/lib/components/"},"timestamp":"2026-04-17T12:00:04.550Z"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:04.590Z","event":"GEMINI_EVENT","data":{"type":"tool_result","tool_id":"1o6dfh4u","status":"COMPLETED","output":"Recovered name test","timestamp":"2026-04-17T12:00:04.590Z"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:04.600Z","event":"GEMINI_EVENT","data":{"type":"unknown_event","foo":"bar"}}',
    '::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-17T12:00:05.000Z","event":"GEMINI_EVENT","data":{"type":"result","status":"SUCCESS","response":"Finished.","stats":{"total_tokens":100,"input_tokens":40,"output_tokens":60,"duration_ms":500},"timestamp":"2026-04-17T12:00:05.000Z"}}'
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
          await expect(page.getByText('Tool Use: read_file', { exact: true })).toBeVisible();
          await expect(page.getByText('"path": "README.md"')).toBeVisible();
        }
      },
      {
        spec: 'Tool use with new field names is visible',
        check: async () => {
          await expect(page.getByText('Tool Use: list_directory', { exact: true })).toBeVisible();
          await expect(page.getByText('(1o6dfh4u)').first()).toBeVisible();
          await expect(page.getByText('"dir_path": "observability-ui/src/lib/components/"')).toBeVisible();
        }
      },
      {
        spec: 'Unknown event is visible',
        check: async () => {
          await expect(page.getByText('Unknown Event: unknown_event')).toBeVisible();
          await expect(page.getByText('"foo": "bar"')).toBeVisible();
        }
      },
      {
        spec: 'Tool result is visible',
        check: async () => {
          await expect(page.getByText('TOOL RESULT: read_file (success)', { exact: true })).toBeVisible();
          await expect(page.getByText('File content...')).toBeVisible();
        }
      },
      {
        spec: 'Tool result with data and status is visible',
        check: async () => {
          await expect(page.getByText('TOOL RESULT: run_shell_command (success)', { exact: true })).toBeVisible();
          await expect(page.getByText('Status: success', { exact: true }).first()).toBeVisible();
          await expect(page.getByText('Done.')).toBeVisible();
        }
      },
      {
        spec: 'Tool result with recovered name is visible',
        check: async () => {
          await expect(page.getByText('TOOL RESULT: list_directory (COMPLETED)', { exact: true })).toBeVisible();
          await expect(page.getByText('Recovered name test')).toBeVisible();
        }
      },
      {
        spec: 'Copy button is visible in JsonTree',
        check: async () => {
          await expect(page.getByRole('button', { name: 'copy' }).first()).toBeVisible();
        }
      },
      {
        spec: 'Final result is visible with stats',
        check: async () => {
          await expect(page.getByText('Gemini Result (SUCCESS)')).toBeVisible();
          await expect(page.getByText('Finished.')).toBeVisible();
          await expect(page.getByText('100 (P: 40, C: 60)')).toBeVisible();
          await expect(page.getByText('500ms')).toBeVisible();
        }
      }
    ]
  });

  helper.generateDocs();
});
