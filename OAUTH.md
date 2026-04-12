# OAuth Implementation

This document describes the OAuth integration for the Conductor Observability UI.

## Overview

The Conductor Observability UI uses GitHub OAuth to authenticate users and gain access to the GitHub API.

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

### 1. Create a GitHub OAuth App

To enable OAuth integration, you must create a GitHub OAuth App:

1.  Go to GitHub **Settings**.
2.  On the left sidebar, scroll down and click **Developer settings**.
3.  Click **OAuth Apps**.
4.  Click **New OAuth App**.
5.  Fill in the details:
    - **Application name**: Conductor Observability UI (or your preferred name)
    - **Homepage URL**: 
        - Local development: `http://localhost:5173`
        - Production: The URL where your UI is hosted (e.g., `https://your-project.web.app`)
    - **Authorization callback URL**:
        - Local development: `http://localhost:5173/auth/callback`
        - Production: `https://your-project.web.app/auth/callback`
6.  Click **Register application**.
7.  Note the **Client ID**.
8.  Click **Generate a new client secret** and note the **Client Secret**.

### 2. Configure Firebase Functions Secrets

The backend exchange function requires the Client ID and Client Secret to be set as secrets in Firebase:

```bash
firebase functions:secrets:set GITHUB_CLIENT_ID
firebase functions:secrets:set GITHUB_CLIENT_SECRET
```

When prompted, paste the values obtained from GitHub.

### 3. Configure Frontend Environment Variables

Update your `.env` file in the root directory (refer to `.env.example`) with the Client ID and the URL of your deployed exchange function.

## Configuration

The following environment variables are required:

- `PUBLIC_GITHUB_CLIENT_ID`: The GitHub OAuth App Client ID.
- `PUBLIC_OAUTH_EXCHANGE_URL`: The URL of the backend service (Firebase Function) that handles the code-to-token exchange.

These are configured in `.env` files and accessed via `$env/static/public` in the SvelteKit application.

## Backend

The backend (Firebase Function) must securely store the `GITHUB_CLIENT_SECRET` and perform the exchange with GitHub's API.

```javascript
// Example exchange logic in Firebase Function
const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
    })
});
```

## E2E Testing

E2E tests in `tests/e2e/003-oauth-flow/` verify the entire flow by mocking:
- The GitHub OAuth authorize redirect.
- The Firebase Function token exchange.
- The GitHub API responses for user profile and repository access.
