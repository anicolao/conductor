import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('GitHub OAuth Flow', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('GitHub OAuth Flow', 'Verify that a user can login via GitHub and see their profile.');

  // Mock Firebase Function
  await page.route('**/githubOAuthExchange', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
      return;
    }
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

  // Mock GitHub OAuth Authorize redirect
  // We'll intercept the click and manually navigate to the callback
  await page.route('https://github.com/login/oauth/authorize*', async (route) => {
    // Navigate to our callback with a fake code
    await page.goto('/auth/callback?code=test_code');
    await route.abort();
  });

  await page.goto('/');

  await helper.step('landing_page_loaded', {
    description: 'Landing page loaded with Login button',
    verifications: [
      { spec: 'Login button is visible', check: async () => expect(page.getByRole('button', { name: 'Login with GitHub' })).toBeVisible() },
      { spec: 'Title is correct', check: async () => expect(page).toHaveTitle('Conductor Observability') }
    ]
  });

  // Click login
  await page.getByRole('button', { name: 'Login with GitHub' }).click();

  // Wait for the profile to load (after redirect to /auth/callback and back to /)
  await expect(page.getByText('Logged in as testuser')).toBeVisible();

  await helper.step('logged_in_profile_visible', {
    description: 'User is logged in and profile is displayed',
    verifications: [
      { spec: 'Username is visible', check: async () => expect(page.getByText('testuser')).toBeVisible() },
      { spec: 'Avatar is visible', check: async () => expect(page.getByAltText('testuser')).toBeVisible() },
      { spec: 'Logout button is visible', check: async () => expect(page.getByRole('button', { name: 'Logout' })).toBeVisible() }
    ]
  });

  // Logout
  await page.getByRole('button', { name: 'Logout' }).click();

  await helper.step('logged_out', {
    description: 'User is logged out and login button is visible again',
    verifications: [
      { spec: 'Login button is visible', check: async () => expect(page.getByRole('button', { name: 'Login with GitHub' })).toBeVisible() },
      { spec: 'Username is not visible', check: async () => expect(page.getByText('testuser')).not.toBeVisible() }
    ]
  });

  helper.generateDocs();
});
