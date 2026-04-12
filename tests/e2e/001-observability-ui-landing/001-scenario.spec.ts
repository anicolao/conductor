import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Observability UI Landing Page', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('Observability UI Landing Page', 'Verify the basic foundation of the Conductor Observability UI.');

  await page.goto('/');

  await helper.step('landing_page_loaded', {
    description: 'User navigates to the landing page',
    verifications: [
      {
        spec: 'Page title contains "Conductor"',
        check: async () => {
          await expect(page).toHaveTitle(/Conductor/);
        }
      },
      {
        spec: '"Conductor Observability" heading is visible',
        check: async () => {
          await expect(page.getByRole('heading', { name: 'Conductor Observability' })).toBeVisible();
        }
      }
    ]
  });

  helper.generateDocs();
});
