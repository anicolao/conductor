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

1. A Projects V2 item in the organization project moves to `In Progress`, OR the `Persona` field is edited.
2. An organization-level webhook receives the event and forwards it to the Bridge (Firebase function).
3. The bridge performs filtering (ignores bots, filters actions) and sends a `repository_dispatch` event to `LLM-Orchestration/conductor`.
4. The Conductor workflow starts from `repository_dispatch`.
5. `src/index.ts` resolves the live issue state and activates the requested persona. It supports issues in any repository as specified in the dispatch payload.

## Workflow Trigger

The workflow now listens exclusively for `repository_dispatch` with the `project_in_progress` type:

```yaml
on:
  repository_dispatch:
    types: [project_in_progress]
```

The dispatch payload includes enriched metadata:

```json
{
  "event_type": "project_in_progress",
  "client_payload": {
    "issue_number": 38,
    "repository": "owner/repo",
    "project_number": 1,
    "project_url": "https://github.com/orgs/LLM-Orchestration/projects/1",
    "status": "In Progress",
    "item_id": "PVTI_lADOB0m...",
    "persona": "coder"
  }
}
```

## Bridge Requirements

The webhook bridge in this repository is a Firebase HTTPS function named `githubProjectsV2Webhook`. It:

1. Verifies the GitHub webhook signature.
2. Filters out events from Bot accounts.
3. Detects specific event types:
   - `projects_v2_item`: 
     - Triggered when the `Status` field is changed to `In Progress` (starts orchestration).
     - Triggered when the `Persona` field is edited while the status is `In Progress` (continues orchestration).
4. Dispatches to `LLM-Orchestration/conductor` with enriched metadata (repository name, issue number, item ID, and project number).

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

1. Add an issue from any repository in the organization to the `AI Orchestration` project.
2. Move it to `In Progress`.
3. The webhook bridge dispatches `project_in_progress`.
4. Conductor activates on that issue and continues with the normal persona handoff flow.
5. The `scripts/handoff.sh` script updates the `Persona` field in the project as its final step, which triggers the next persona's run.

## Notes

- `repository_dispatch` is the only GitHub-native workflow trigger in this chain.
- `labeled` events are explicitly excluded from the workflow configuration to prevent redundant or recursive runs when agents update state.
- The project itself is for centralized visibility and control.
- The webhook bridge is what converts project activity into a workflow event.
