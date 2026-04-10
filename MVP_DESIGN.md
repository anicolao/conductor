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

## State Management: Labels

Conductor uses **GitHub Issue Labels** to maintain state across ephemeral GitHub Action runner invocations.

1. **Persona Assignment**: The label `persona: <name>` (e.g., `persona: coder`) determines which persona is active.
2. **Branch Tracking**: The label `branch: <name>` (e.g., `branch: feat/json-parser`) tells the framework which Git branch to checkout before executing the persona logic.
3. **Execution**: The GitHub Action triggers on **issue creation**, **comments**, or **repository dispatches**. It does **not** trigger on label changes to prevent redundant or out-of-order execution (labels are updated before the handoff comment). It inspects the labels to set up the environment (checkout the right branch) and load the correct persona.
4. **Handoff**: A persona hands off by:
   - Setting the `persona:` label for the next agent.
   - Setting (or maintaining) the `branch:` label.
   - Posting a comment with instructions.

## Workflow: Feature-to-PR

### 1. Initiation
A **User** creates a GitHub Issue and describes a feature, mentioning `@conductor`, or moves an existing issue to **In Progress** on the project board (triggering a repository dispatch).
> **User**: `@conductor` - I need a new utility to parse JSON logs in the `utils/` directory.

### 2. Planning & Delegation
The **GitHub Action** triggers (on issue creation, comment, or repository dispatch). Finding no `persona:` label but seeing the `@conductor` mention (or receiving a dispatch), it checks out `main` and invokes Gemini CLI as the **@conductor**.
- `@conductor` creates a new branch `feat/json-parser`.
- **Handoff**: `@conductor` adds labels `persona: coder` and `branch: feat/json-parser`, then comments with instructions.

### 3. Implementation
The **GitHub Action** triggers (on `@conductor`'s comment). It sees `branch: feat/json-parser`, checks it out, and invokes Gemini CLI as the **@coder**.
- `@coder` performs the implementation and tests.
- `@coder` commits and pushes changes to the branch.
- **Handoff**: `@coder` sets the label back to `persona: conductor` and comments that work is ready.

### 4. Verification & PR
The **GitHub Action** triggers (on `@coder`'s comment), checks out `feat/json-parser`, and invokes Gemini CLI as the **@conductor**.
- `@conductor` runs tests and reviews the code.
- If verified: `@conductor` opens a Pull Request via `gh` and removes the `persona:` and `branch:` labels.

## Technical Implementation Details

### GitHub Action Configuration
The workflow determines the active persona and branch by inspecting the issue labels. It performs a `git checkout` of the specified branch before running the TypeScript dispatcher.

### Agent Environment
Each agent (Gemini CLI) is provided with:
- Full repository access on the correct feature branch.
- A system prompt defining its role.
- Tools for code modification, git operations, and `gh` CLI for state/PR management.
