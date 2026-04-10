# Projects V2 Integration

## Current Setup

Conductor now lives at `LLM-Orchestration/conductor` and the shared project board is:

- Organization: `LLM-Orchestration`
- Project: `AI Orchestration`
- URL: `https://github.com/orgs/LLM-Orchestration/projects/1`

The repository is linked to that organization-owned project so repository issues can be added to it directly.

## Why The Old Design Failed

GitHub Actions does not support `project_item` as a workflow trigger, and personal user-level Projects V2 do not provide the webhook path needed for event-driven automation.

That means this does not work:

```yaml
on:
  project_item:
    types: [edited, created]
```

The workflow file can still load, but no Actions run will ever be created from that trigger.

## Implemented Architecture

The working design is:

1. A Projects V2 item in the organization project moves to `In Progress`.
2. An organization-level webhook or GitHub App receives the `projects_v2_item` event.
3. That bridge sends a `repository_dispatch` event to `LLM-Orchestration/conductor`.
4. The Conductor workflow starts from `repository_dispatch`.
5. `src/index.ts` resolves the live issue state and activates `persona: conductor` if no persona is already active.

## Workflow Trigger

The workflow is now centralized to only listen for `repository_dispatch`. All other events (issue creation, comments) are handled by the bridge, which then dispatches to this repository. This centralizes the logic and prevents duplicate runs for issues in the `conductor` repository.

```yaml
on:
  repository_dispatch:
    types: [project_in_progress]
```

All `issues` and `issue_comment` events are now bridged through the Firebase function to prevent duplicate runs and event loops.

The dispatch contract is:

```json
{
  "event_type": "project_in_progress",
  "client_payload": {
    "repository": "LLM-Orchestration/conductor",
    "issue_number": 38,
    "issue_url": "https://github.com/LLM-Orchestration/conductor/issues/38",
    "issue_node_id": "I_kwDOK7z8z852Y8-Y",
    "project_number": 1,
    "project_url": "https://github.com/orgs/LLM-Orchestration/projects/1",
    "status": "In Progress",
    "event_name": "issue_comment",
    "action": "created"
  }
}
```

## Bridge Requirements

The webhook bridge in this repository is a Firebase HTTPS function named `githubProjectsV2Webhook`. It now performs several optimizations:

1. **Verify Webhook Signature**: Ensures events come from GitHub.
2. **Filter Actions**: Only dispatches for `issues:opened` and `issue_comment:created`.
3. **Filter Senders**: Ignores events from bots to prevent feedback loops.
4. **Enrich Payload**: Includes `event_name`, `action`, the event `body`, `issue_url`, and `issue_node_id` in the `repository_dispatch` sent to Conductor.
5. **Call**:

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $CONDUCTOR_TOKEN" \
  https://api.github.com/repos/LLM-Orchestration/conductor/dispatches \
  -d '{
    "event_type": "project_in_progress",
    "client_payload": {
      "repository": "LLM-Orchestration/conductor",
      "issue_number": 38,
      "issue_url": "https://github.com/LLM-Orchestration/conductor/issues/38",
      "issue_node_id": "I_kwDOK7z8z852Y8-Y",
      "project_number": 1,
      "project_url": "https://github.com/orgs/LLM-Orchestration/projects/1",
      "status": "In Progress",
      "event_name": "issue_comment",
      "action": "created",
      "body": "@conductor please help"
    }
  }'
```

## Firebase Deployment

The Firebase project for this bridge is:

- Project ID: `llm-orch-conductor-bridge`
- Console: `https://console.firebase.google.com/project/llm-orch-conductor-bridge/overview`

The Firebase project alias for this repository is also `llm-orch-conductor-bridge`.

Root npm entry points:

- `npm run firebase:deploy`
- `npm run firebase:serve`

Required Firebase function secrets:

- `GITHUB_WEBHOOK_SECRET`
- `CONDUCTOR_TOKEN`

Deployment status:

- The project was created successfully.
- Cloud Functions deployment is currently blocked because the new Firebase project is still on the Spark plan.
- Firebase requires Blaze before it will enable `cloudfunctions.googleapis.com`, `cloudbuild.googleapis.com`, and `secretmanager.googleapis.com`.

After the project is upgraded to Blaze, the remaining steps are:

1. set `GITHUB_WEBHOOK_SECRET`
2. set `CONDUCTOR_TOKEN`
3. deploy `githubProjectsV2Webhook`
4. point the GitHub organization webhook at the deployed function URL

## Required Token Permissions

`CONDUCTOR_TOKEN` must be able to:

- read and write repository contents as needed by the agents
- update workflows
- read and write Projects V2
- edit issues and labels

The current local `gh` token and repo secret were refreshed with:

- `repo`
- `workflow`
- `project`
- `read:org`

## Operator Flow

The Conductor can be triggered in two ways:

### 1. Project-Based (Orchestration)
1. Add an issue from any repository in the `LLM-Orchestration` organization to the `AI Orchestration` project.
2. Move it to `In Progress`.
3. The webhook bridge dispatches `project_in_progress` to the `conductor` repository.
4. Conductor activates on that issue in its respective repository.

### 2. Comment-Based (Direct Interaction)
1. Mention `@conductor` in a comment on any issue in an orchestrated repository.
2. The webhook bridge detects the mention and dispatches `project_in_progress` with `event_name: issue_comment`.
3. Conductor activates and takes over the issue.

### Loop Prevention
- The bridge explicitly ignores events from bot accounts (senders with `type: Bot` or login ending in `[bot]`).
- The bridge only dispatches for specific actions (`issues:opened` and `issue_comment:created`).
- The Conductor workflow no longer listens directly to `issues` or `issue_comment` events, centralizing all triggers through the bridge.

## Notes

- `repository_dispatch` is the only GitHub-native workflow trigger in this chain.
- `labeled` events are explicitly excluded from the workflow configuration to prevent redundant or recursive runs when agents update state.
- The project itself is for centralized visibility and control.
- The webhook bridge is what converts project activity into a workflow event.

## Cross-Repository Orchestration

The Conductor is designed to be a central orchestrator for an entire organization. It can be triggered by events from any repository and will automatically checkout the target repository to perform its work.

### How it Works

1.  **Trigger**: An event occurs in any repository (e.g., an issue is moved to "In Progress" in an org-level project, or `@conductor` is mentioned in an issue comment).
2.  **Bridge**: The Firebase Bridge function receives the org-level webhook and dispatches a `repository_dispatch` event to the central `LLM-Orchestration/conductor` repository.
3.  **Workflow**: The Conductor workflow starts and:
    *   Determines the target repository and issue number from the payload.
    *   Performs a **Dual Checkout**:
        *   Target Repo is checked out to `.` (the root).
        *   Conductor Repo is checked out to `.conductor/`.
    *   The Conductor logic runs from `.conductor/` but executes the Gemini CLI with the working directory set to the root (`.`), where the target repo resides.
4.  **Handoff**: The agents use the handoff script located at `.conductor/scripts/handoff.sh`, which explicitly targets the target repository using the `-R` flag.

### Deployment Notes

*   **GitHub Token**: The `CONDUCTOR_TOKEN` secret in the central repository must have `write` access to all repositories it is expected to orchestrate.
*   **Webhook**: The GitHub App or Webhook must be configured at the **Organization** level to receive events from all repositories.
*   **Standard Labels**: All repositories should use the same `persona:` and `branch:` label conventions for seamless orchestration.
