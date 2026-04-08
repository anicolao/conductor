# MVP Design: The Conductor Core

The MVP of Conductor is a streamlined coordination framework inspired by the simplicity of Overseer (commit `b863783c2defddaad655b2a12cd94fc383f9e8f9`). It uses GitHub Issues for state management and GitHub Actions as the execution environment, with **Gemini CLI** as the intelligence backend.

## Personas

Conductor uses two primary personas for the MVP:

1. **`@conductor`**: The Orchestrator.
   - **Role**: Plans the implementation, delegates tasks, and performs final verification.
   - **Backend**: Gemini CLI with a prompt focused on project architecture and verification.
   - **Action**: Receives user requests, tasks `@coder`, reviews their work, and opens Pull Requests.

2. **`@coder`**: The Implementer.
   - **Role**: Executes specific code changes and writes tests.
   - **Backend**: Gemini CLI with a prompt focused on surgical code modification and testing.
   - **Action**: Receives instructions from `@conductor`, performs the changes, and reports back.

## Workflow: Feature-to-PR

The core of Conductor is a loop that mirrors a standard development lifecycle:

### 1. Initiation
A **User** creates a GitHub Issue describing a feature and tags `@conductor`.
> **User**: `@conductor` - I need a new utility to parse JSON logs in the `utils/` directory.

### 2. Planning & Delegation
The **GitHub Action** triggers on the `@conductor` tag, invoking Gemini CLI as the `@conductor` persona.
- `@conductor` analyzes the codebase and the request.
- `@conductor` creates a new branch (e.g., `feat/json-parser`).
- `@conductor` comments on the issue tagging `@coder` with specific implementation instructions.
> **@conductor**: `@coder` - Please implement a `LogParser` class in `utils/log_parser.ts`. Include unit tests in `tests/log_parser.spec.ts`. Use the current branch `feat/json-parser`.

### 3. Implementation
The **GitHub Action** triggers on the `@coder` tag, invoking Gemini CLI as the `@coder` persona.
- `@coder` reads the instructions and the code.
- `@coder` implements the feature and the tests.
- `@coder` commits and pushes the changes to the branch.
- `@coder` comments on the issue tagging `@conductor` that the work is ready for review.
> **@coder**: `@conductor` - Implementation and tests are complete on `feat/json-parser`. Ready for verification.

### 4. Verification & PR
The **GitHub Action** triggers on the `@conductor` tag.
- `@conductor` (Gemini CLI) checks out the branch.
- `@conductor` runs the tests and performs a static review of the code.
- If verified: `@conductor` uses `gh` to open a Pull Request and tags the user for final approval.
- If errors exist: `@conductor` tags `@coder` again with specific feedback, repeating Step 3.
> **@conductor**: `@user` - The JSON log parser has been implemented and verified. PR #123 is open for your final review.

## Technical Implementation Details

### GitHub Action Configuration
The workflow triggers on `issue_comment` and `issues` events. It uses the `github.event.comment.body` or `github.event.issue.body` to identify the persona and the instructions.

### Agent Environment
Each agent (Gemini CLI) is provided with:
- Full access to the repository via `actions/checkout`.
- A system prompt defining its persona (`@conductor` or `@coder`).
- The conversation history from the GitHub Issue thread.
- Standard tools for code modification, git operations, and test execution.

By keeping the protocol to natural language comments on GitHub, we ensure the framework is self-documenting and easy for humans to intervene in if necessary.
