# MVP Design: The Conductor Core

The MVP of Conductor is a streamlined coordination framework inspired by the simplicity of [Overseer (commit b863783c2def)](https://github.com/anicolao/overseer/commit/b863783c2defddaad655b2a12cd94fc383f9e8f9). It uses GitHub Issues for state management and GitHub Actions as the execution environment, with **Gemini CLI** as the intelligence backend.

## Personas

Conductor uses two primary personas for the MVP:

1. **`@conductor`**: The Orchestrator.
   - **Role**: Plans implementation, delegates tasks, and performs final verification.
   - **Action**: Receives user requests, assigns tasks to `@coder`, reviews work, and opens Pull Requests.

2. **`@coder`**: The Implementer.
   - **Role**: Executes specific code changes and writes tests.
   - **Action**: Receives instructions from `@conductor`, performs changes, and reports back.

## Persona Assignment Mechanism

To ensure reliability and clear handoff, Conductor uses **GitHub Issue Labels** to explicitly assign the active persona, with **Comments** as the primary execution trigger.

1. **Explicit Labeling**: If a `persona: <name>` label is present (e.g., `persona: coder`), the workflow loads that persona's system prompt into Gemini CLI.
2. **Implicit Initiation**: If **no** `persona:` label is present, the framework checks the comment (or issue body) for an `@conductor` mention. If found, it defaults to the `@conductor` persona.
3. **Execution**: The GitHub Action triggers on:
   - `issues` (opened): Allows `@conductor` to respond to a new issue immediately if mentioned.
   - `issue_comment` (created): The primary loop trigger for handoffs between personas.
4. **Filtering**: If no `persona:` label is found AND `@conductor` is not mentioned, the workflow exits without action.
5. **Handoff**: A persona hands off by setting the *next* persona's label and then posting a comment with instructions.

## Workflow: Feature-to-PR

### 1. Initiation
A **User** creates a GitHub Issue and describes a feature, mentioning `@conductor`.
> **User**: `@conductor` - I need a new utility to parse JSON logs in the `utils/` directory.

### 2. Planning & Delegation
The **GitHub Action** triggers. Finding no label but seeing the `@conductor` mention, it invokes Gemini CLI as the **@conductor**.
- `@conductor` analyzes the codebase and request.
- `@conductor` creates a new branch (e.g., `feat/json-parser`).
- **Handoff**: `@conductor` sets the issue label to `persona: coder` and then comments with instructions.
> **@conductor**: `@coder` - Please implement a `LogParser` class in `utils/log_parser.ts`. Include unit tests in `tests/log_parser.spec.ts`. Use the current branch `feat/json-parser`.

### 3. Implementation
The **GitHub Action** triggers on the comment. Finding the `persona: coder` label, it invokes Gemini CLI as the **@coder**.
- `@coder` performs the implementation and tests.
- `@coder` commits and pushes changes to the branch.
- **Handoff**: `@coder` sets the issue label back to `persona: conductor` and comments that work is ready.
> **@coder**: `@conductor` - Implementation and tests are complete on `feat/json-parser`. Ready for verification.

### 4. Verification & PR
The **GitHub Action** triggers. Finding the `persona: conductor` label, it invokes Gemini CLI as the **@conductor**.
- `@conductor` checks out the branch, runs tests, and reviews the code.
- If verified: `@conductor` opens a Pull Request via `gh` and removes the `persona:` labels, tagging the user for final approval.
- If errors exist: `@conductor` sets the label back to `persona: coder` and provides feedback in a new comment.

## Technical Implementation Details

### GitHub Action Configuration
The workflow triggers on `issues` (opened) and `issue_comment` (created) events. It determines the active persona by inspecting labels for `persona: <name>`, falling back to an `@conductor` mention check if no label exists.

### Agent Environment
Each agent (Gemini CLI) is provided with:
- Full repository access via `actions/checkout`.
- A system prompt defining its role (`@conductor` or `@coder`).
- The conversation history and issue context.
- Tools for code modification, git operations, and `gh` CLI for label/PR management.
