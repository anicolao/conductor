# Design Document: GitHub Projects V2 Integration

## Overview
Currently, Conductor is triggered by issue comments or new issues mentioning `@conductor`. This document proposes an integration with GitHub Projects V2 where dragging an issue into the "In Progress" column automatically initiates the Conductor workflow.

## Objectives
- Seamlessly trigger `@conductor` when an issue is prioritized in a Project.
- Maintain the label-based state management system.
- Support user-level projects (specifically `https://github.com/users/anicolao/projects/1`).

## Proposed Changes

### 1. GitHub Actions Workflow Update
We will update `.github/workflows/conductor.yml` to handle `project_item` events.

```yaml
on:
  project_item:
    types: [edited, created]
  issue_comment:
    types: [created]
  issues:
    types: [opened, labeled]
```

### 2. Trigger Logic (in Workflow)
The workflow job will be updated with a more flexible `if` condition or a preliminary step to detect the "In Progress" move.

```yaml
    if: >
      github.event.issue && (contains(github.event.comment.body, '@conductor') || contains(github.event.issue.body, '@conductor') || contains(github.event.issue.labels.*.name, 'persona:'))
      || (github.event_name == 'project_item' && github.event.action == 'edited' && github.event.changes.field_value.field_name == 'Status')
```

### 3. Source Code Modifications (`src/index.ts`)
The `src/index.ts` entry point currently expects `github.event.issue`. We will:
- Update the `GitHubEvent` interface to handle `project_item` payloads.
- Implement a resolver that, given a `project_item` event, uses the GitHub CLI to find the corresponding issue number.
- If the event is a valid "In Progress" move, it will automatically activate the `@conductor` persona.

### 4. State Management Integration
When a `project_item` move to "In Progress" is detected:
1. The system will check if a `persona:` label already exists.
2. If not, it will apply `persona: conductor` to the issue.
3. It will proceed with the standard `@conductor` planning phase.

## Technical Details: Project V2 Payload
When a field is edited in Projects V2, the `project_item` event payload includes:
- `project_item.content_node_id`: The GraphQL ID of the issue.
- `project_item.content_type`: Must be `Issue`.
- `changes.field_value.field_name`: The name of the field that changed (e.g., `Status`).
- We will need to fetch the current value of the field to confirm it is "In Progress" using `gh project item-list`.

## Required Permissions
The `CONDUCTOR_TOKEN` will need `read:project` scope to inspect project field values and `write:issues` to apply labels.

## Verification Plan
1. **Manual Test**: Move an issue to "In Progress" in the specified project.
2. **Observation**: Confirm the GitHub Action triggers and the issue receives the `persona: conductor` label.
3. **End-to-End**: Verify `@conductor` responds with a plan as if it had been mentioned.
