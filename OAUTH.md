# OAuth Implementation

This document describes the OAuth integration for the Conductor Observability UI.

## Overview

The Conductor Observability UI uses GitHub OAuth to authenticate users and gain access to the GitHub API. This allows the UI to show user profile information and verify access to relevant repositories.

## Flow

1. **Initiate Login**: The user clicks the "Login with GitHub" button on the landing page.
   - The application saves the current path in `sessionStorage` as `oauth_redirect_path`.
   - The user is redirected to `https://github.com/login/oauth/authorize` with the `client_id` and requested `scope` (currently `repo,workflow`).

2. **GitHub Authorization**: The user authorizes the application on GitHub.

3. **Callback**: GitHub redirects the user back to the application's callback URL (e.g., `/auth/callback?code=...`).
   - The `auth/callback` page extracts the `code` from the URL.
   - It sends this code to a Firebase Function (`githubOAuthExchange`) to exchange it for an `access_token`.
   - The `access_token` is stored in `sessionStorage` as `github_access_token`.
   - The application retrieves the `oauth_redirect_path` from `sessionStorage` and redirects the user back to that path.

4. **Authenticated State**:
   - On mount, the main layout or page checks for `github_access_token`.
   - If present, it fetches the user's profile from `https://api.github.com/user`.
   - It also fetches repository information (e.g., `LLM-Orchestration/conductor`) to verify that the token has the necessary permissions.
   - A success message "GitHub API Verified ✅" is displayed if the repository access is successful.

## Setup Instructions

To set up the OAuth flow from scratch, follow these steps:

### 1. Create a GitHub OAuth App

1.  Log in to your GitHub account.
2.  Go to **Settings** (click your profile picture in the top right corner).
3.  On the left sidebar, scroll to the bottom and click **Developer settings**.
4.  Click **OAuth Apps**.
5.  Click the **New OAuth App** button.
6.  Fill in the application details:
    - **Application name**: `Conductor Observability UI` (or any name you prefer).
    - **Homepage URL**:
        - For local development: `http://localhost:5173`
        - For production: The URL where your UI is hosted (e.g., `https://your-project.web.app`).
    - **Application description**: (Optional) A brief description of the app.
    - **Authorization callback URL**: This must match the route in the UI that handles the callback.
        - For local development: `http://localhost:5173/auth/callback`
        - For production: `https://your-project.web.app/auth/callback`
7.  Click **Register application**.
8.  On the application page, you will see your **Client ID**. Copy this for later.
9.  Click **Generate a new client secret**. Copy the **Client Secret** immediately, as it won't be shown again.

### 2. Configure Firebase Functions Secrets

The backend exchange function (`githubOAuthExchange`) needs the GitHub Client ID and Client Secret to securely exchange the authorization code for an access token. These should be set as Firebase secrets:

```bash
# Set the GitHub Client ID
firebase functions:secrets:set GITHUB_CLIENT_ID

# Set the GitHub Client Secret
firebase functions:secrets:set GITHUB_CLIENT_SECRET
```

When prompted by the CLI, paste the values you obtained from the GitHub OAuth App settings.

### 3. Configure Frontend Environment Variables

The SvelteKit frontend needs to know the Client ID and the URL of the exchange function.

1.  Create a `.env` file in the root of the project (copying from `.env.example`).
2.  Set `PUBLIC_GITHUB_CLIENT_ID` to your GitHub OAuth App Client ID.
3.  Set `PUBLIC_OAUTH_EXCHANGE_URL` to the URL of your `githubOAuthExchange` function.
    - Local development (using Firebase Emulators): `http://127.0.0.1:5001/llm-orch-conductor-bridge/us-central1/githubOAuthExchange`
    - Production: `https://<region>-<project-id>.cloudfunctions.net/githubOAuthExchange`

## Configuration Reference

The following environment variables are used in the UI:

- `PUBLIC_GITHUB_CLIENT_ID`: The GitHub OAuth App Client ID.
- `PUBLIC_OAUTH_EXCHANGE_URL`: The URL of the backend Firebase Function that handles the code-to-token exchange.

These are accessed via `$env/static/public` in the SvelteKit application, ensuring they are available in the browser.

## Backend Implementation Note

The `githubOAuthExchange` function (located in `functions/index.js`) uses the `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` environment variables (populated from Firebase Secrets) to perform a `POST` request to `https://github.com/login/oauth/access_token`.

## Verification

To verify your setup:
1.  Start the Firebase emulators: `firebase emulators:start`.
2.  Start the SvelteKit dev server: `cd observability-ui && npm run dev`.
3.  Navigate to `http://localhost:5173` and click **Login with GitHub**.
4.  After authorizing, you should be redirected back and see your GitHub profile information.

## E2E Testing

E2E tests are located in `tests/e2e/003-oauth-flow/`. These tests verify the entire flow by mocking the GitHub and Firebase interactions. They can be run using Playwright:

```bash
npx playwright test tests/e2e/003-oauth-flow/
```
