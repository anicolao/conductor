# Design Document: Conductor Observability UI

This document outlines the design for a new observability interface for Conductor. The goal is to provide real-time and historical visibility into Conductor's activities, moving from unstructured logs to a structured, event-sourced representation.

## 1. Overview

The Conductor Observability UI will be a standalone SvelteKit application hosted on GitHub Pages. it will serve as a central hub for developers and operators to monitor "blow-by-blow" actions of Conductor across various repositories, issues, and PRs.

## 2. System Architecture

- **Frontend**: SvelteKit (Static Site Generation / SSG).
- **Styling**: Vanilla CSS (Svelte-scoped).
- **Data Source**: GitHub REST and GraphQL APIs.
- **Authentication**: GitHub OAuth.
- **Hosting**: GitHub Pages.
- **State Management**: Svelte stores, persisted via browser session storage/local storage for session info.

## 3. Authentication: GitHub OAuth

Instead of requiring users to provide a Personal Access Token (PAT), the UI will use a GitHub App and OAuth flow.

1. **User Login**: Users click "Login with GitHub".
2. **Authorization**: Users authorize the Conductor Observability App.
3. **Token Exchange**: A small backend shim (possibly a GitHub Action or a lightweight Cloud Function/Firebase function) will exchange the code for an access token.
4. **API Access**: The frontend uses the access token to fetch data directly from GitHub APIs.

*Note: Since GitHub Pages is static, the OAuth "secret" cannot be stored there. We will use the existing Firebase bridge or a dedicated GitHub App to handle the exchange.*

## 4. Structured Logging: Event Schema

To enable the UI to render a rich timeline of events, Conductor will transition to emitting structured JSON events to `stdout`.

### Base Event Schema
Every event will follow this structure:

```json
{
  "v": 1,
  "ts": "2026-04-11T12:00:00.000Z",
  "run_id": "1234567890",
  "repo": "LLM-Orchestration/conductor",
  "issue": 61,
  "persona": "coder",
  "event": "event_type",
  "data": {}
}
```

### Event Types
- **`session_start`**: Emitted when a persona is activated. Payload includes the branch, system prompt (truncated), and context metadata.
- **`exec_start`**: Emitted before running a shell command. Payload includes the command and working directory.
- **`exec_end`**: Emitted after a command finishes. Payload includes exit code and a reference to output.
- **`gemini_stream`**: Emitted for chunks of output from Gemini. Payload includes the text chunk and stream type (stdout/stderr).
- **`tool_use`**: Emitted when Conductor identifies a tool call. Payload includes the tool name and arguments.
- **`handoff`**: Emitted when the persona completes its task and triggers a handoff. Payload includes the target persona and summary.
- **`session_end`**: Emitted on completion (success or failure). Payload includes final status and error details if applicable.

## 5. User Interface Design

### Real-Time Dashboard
- **Active Runs**: A live list of currently executing GitHub Actions runs labeled with Conductor personas.
- **Live Console**: A terminal-like view that streams `gemini_stream` and `exec` events as they happen.
- **Status Indicators**: Visual cues for "Planning", "Implementing", "Verifying", "Handoff".

### Historical Analysis
- **Issue Timeline**: Drill down into a specific issue to see all Conductor sessions associated with it over time.
- **Diff View**: Integrate with GitHub's diffs to show exactly what code was changed in each step.
- **Search & Filter**: Filter by repository, issue number, persona, or date range.

### Project Board Integration ("Platform 10")
- The UI will link directly to the "Platform 10" project board.
- It will represent the state of items in the "In Progress" column and show which persona is currently assigned.

## 6. Data Fetching Strategy

The UI will primarily use the following GitHub APIs:
- `GET /repos/{owner}/{repo}/actions/runs`: To find active and past workflows.
- `GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs`: To fetch the raw logs.
- **Log Parser**: A client-side parser will scan the logs for the structured JSON events (prefixed with a specific marker like `::CONDUCTOR_EVENT::`) and reconstruct the event stream.
- `GET /repos/{owner}/{repo}/issues/{issue_number}`: To get issue metadata and comments.

## 7. Implementation Phases

### Phase 1: Structured Logging
- Update `src/index.ts` and `src/utils/exec.ts` to emit the JSON events.
- Wrap `gemini-cli` invocation to capture and stream its output as structured events.

### Phase 2: Static UI Shell
- Scaffold the SvelteKit app.
- Implement GitHub OAuth flow.
- Setup GitHub Pages deployment.

### Phase 3: Historical Viewer
- Implement the log fetching and parsing logic.
- Create the timeline view for past sessions.

### Phase 4: Real-Time Monitoring
- Implement polling (or WebSockets if supported by a bridge) to refresh active run status and stream logs.

## 8. Security Considerations

- **Token Safety**: Access tokens will be stored in `sessionStorage` and never logged.
- **Scope Limiting**: The OAuth app will request the minimum necessary scopes (`repo`, `workflow`).
- **Data Privacy**: The UI is a client-side only app; no data is stored on the hosting server beyond the static assets.
