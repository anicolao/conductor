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

The workflow now listens for:

```yaml
on:
  repository_dispatch:
    types: [project_in_progress]
  issue_comment:
    types: [created]
  issues:
    types: [opened]
```

The dispatch contract is:

```json
{
  "event_type": "project_in_progress",
  "client_payload": {
    "issue_number": 38,
    "project_number": 1,
    "project_url": "https://github.com/orgs/LLM-Orchestration/projects/1",
    "status": "In Progress"
  }
}
```

## Bridge Requirements

The webhook bridge can be a GitHub App handler, a small HTTP service, or a serverless function. It only needs to do three things:

1. Verify the GitHub webhook signature.
2. Detect that the item belongs to the `AI Orchestration` project and its status became `In Progress`.
3. Call:

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $CONDUCTOR_TOKEN" \
  https://api.github.com/repos/LLM-Orchestration/conductor/dispatches \
  -d '{
    "event_type": "project_in_progress",
    "client_payload": {
      "issue_number": 38,
      "project_number": 1,
      "project_url": "https://github.com/orgs/LLM-Orchestration/projects/1",
      "status": "In Progress"
    }
  }'
```

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

1. Add an issue from `LLM-Orchestration/conductor` to the `AI Orchestration` project.
2. Move it to `In Progress`.
3. The webhook bridge dispatches `project_in_progress`.
4. Conductor activates on that issue and continues with the normal persona handoff flow.

## Notes

- `repository_dispatch` is the only GitHub-native workflow trigger in this chain.
- The project itself is for centralized visibility and control.
- The webhook bridge is what converts project activity into a workflow event.
