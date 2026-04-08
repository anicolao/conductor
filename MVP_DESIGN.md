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

To ensure reliability and clear handoff, Conductor uses **GitHub Issue Labels** to explicitly assign the active persona.

1. **Labeling**: The current persona is responsible for setting the label for the *next* persona in the sequence (e.g., `persona: coder`).
2. **Execution**: The GitHub Action triggers when the label is updated or a new comment is added.
3. **Identification**: The workflow reads the `persona:` label to determine which persona's system prompt to load into Gemini CLI.
4. **Handoff**: After setting the label, the current persona posts a comment with instructions for the next persona.

## Workflow: Feature-to-PR

### 1. Initiation
A **User** creates a GitHub Issue, sets the label `persona: conductor`, and describes a feature.
> **User**: `@conductor` - I need a new utility to parse JSON logs in the `utils/` directory.

### 2. Planning & Delegation
The **GitHub Action** triggers. Finding the `persona: conductor` label, it invokes Gemini CLI as the **@conductor**.
- `@conductor` analyzes the codebase and request.
- `@conductor` creates a new branch (e.g., `feat/json-parser`).
- **Handoff**: `@conductor` sets the issue label to `persona: coder` and comments with instructions.
> **@conductor**: `@coder` - Please implement a `LogParser` class in `utils/log_parser.ts`. Include unit tests in `tests/log_parser.spec.ts`. Use the current branch `feat/json-parser`.

### 3. Implementation
The **GitHub Action** triggers again. Finding the `persona: coder` label, it invokes Gemini CLI as the **@coder**.
- `@coder` reads the instructions and code.
- `@coder` implements the feature and tests.
- `@coder` commits and pushes changes to the branch.
- **Handoff**: `@coder` sets the issue label back to `persona: conductor` and comments that work is ready.
> **@coder**: `@conductor` - Implementation and tests are complete on `feat/json-parser`. Ready for verification.

### 4. Verification & PR
The **GitHub Action** triggers. Finding the `persona: conductor` label, it invokes Gemini CLI as the **@conductor**.
- `@conductor` checks out the branch, runs tests, and reviews the code.
- If verified: `@conductor` opens a Pull Request via `gh` and removes the `persona:` labels, tagging the user for final approval.
- If errors exist: `@conductor` sets the label back to `persona: coder` and provides feedback.

## Technical Implementation Details

### GitHub Action Configuration
The workflow triggers on `issues` (labeled) and `issue_comment` (created) events. It determines the active persona by inspecting the issue's labels for the pattern `persona: <name>`.

### Agent Environment
Each agent (Gemini CLI) is provided with:
- Full repository access via `actions/checkout`.
- A system prompt defining its role (`@conductor` or `@coder`).
- The conversation history and issue context.
- Tools for code modification, git operations, and `gh` CLI for label/PR management.
