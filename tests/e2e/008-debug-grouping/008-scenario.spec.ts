import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Observability Debug Message Grouping', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('Observability Debug Message Grouping', 'Verify that consecutive debug messages are grouped into a collapsed card.');

  await page.goto('/debug');

  await helper.step('debug_page_loaded', {
    description: 'User navigates to the debug page',
    verifications: []
  });

  const logs = `
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:00.000Z","event":"LOG_DEBUG","persona":"coder","data":{"message":"First debug message"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:00.500Z","event":"GEMINI_EVENT","persona":"coder","data":{"type":"init","sessionId":"123","model":"gemini-pro"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:01.000Z","event":"LOG_DEBUG","persona":"coder","data":{"message":"Second debug message"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:02.000Z","event":"LOG_INFO","persona":"coder","data":{"message":"An info message"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:03.000Z","event":"LOG_DEBUG","persona":"coder","data":{"message":"Single debug message"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:04.000Z","event":"LOG_INFO","persona":"coder","data":{"message":"Another info message"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:05.000Z","event":"GEMINI_EVENT","persona":"coder","data":{"type":"message","role":"assistant","content":"I am a message bus message","_isMessageBus":true}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:05.500Z","event":"GEMINI_EVENT","persona":"coder","data":{"type":"tool-calls-update","toolCalls":[],"schedulerId":"abc"}}
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:06.000Z","event":"LOG_DEBUG","persona":"coder","data":{"message":"Debug after message bus"}}
  `.trim();

  await page.fill('textarea', logs);

  await helper.step('debug_messages_grouped', {
    description: 'Consecutive debug messages are grouped',
    verifications: [
      {
        spec: 'Two debug groups, two info messages, and one single debug message are visible',
        check: async () => {
          // Group(1, init, 2), Info, Single(3), Info, Group(MessageBus, ToolUpdate, Debug)
          await expect(page.locator('.log_debug_group')).toHaveCount(2);
          await expect(page.locator('.log_info')).toHaveCount(2);
          await expect(page.locator('.log_debug')).toHaveCount(1);
        }
      },
      {
        spec: 'Single debug message is visible',
        check: async () => {
          await expect(page.getByText('Single debug message')).toBeVisible();
        }
      },
      {
        spec: 'First group shows (3) and is collapsed',
        check: async () => {
          const firstGroup = page.locator('.log_debug_group').first();
          await expect(firstGroup.getByText('DEBUG MESSAGES (3)')).toBeVisible();
          const isOpen = await firstGroup.evaluate((el: HTMLDetailsElement) => el.open);
          expect(isOpen).toBe(false);
          await expect(page.getByText('First debug message')).not.toBeVisible();
        }
      },
      {
        spec: 'Second group shows (3) and contains Gemini event',
        check: async () => {
          const secondGroup = page.locator('.log_debug_group').nth(1);
          await expect(secondGroup.getByText('DEBUG MESSAGES (3)')).toBeVisible();
        }
      }
    ]
  });

  // Action outside step
  await page.locator('.log_debug_group').nth(1).click();

  await helper.step('expand_debug_group', {
    description: 'User expands a debug group',
    verifications: [
      {
        spec: 'Group is now expanded and Gemini message is visible',
        check: async () => {
          const secondGroup = page.locator('.log_debug_group').nth(1);
          const isOpen = await secondGroup.evaluate((el: HTMLDetailsElement) => el.open);
          expect(isOpen).toBe(true);
          await expect(page.getByText('I am a message bus message')).toBeVisible();
          await expect(page.getByText('Debug after message bus')).toBeVisible();
        }
      }
    ]
  });

  helper.generateDocs();
});
