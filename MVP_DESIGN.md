# MVP Design: Bootstrapping Conductor

The MVP for Conductor focuses on the "Self-Improvement Loop"—enabling the framework to work on its own repository.

## Architecture

### 1. State Store: GitHub Issues
- **Issues** represent the "Tasks."
- **Labels** represent the "Personas" (e.g., `@architect`, `@coder`, `@tester`).
- **Comments** represent the "Handoff" and context.

### 2. Execution Engine: GitHub Actions
- A single "Conductor Action" triggered by issue comments or labels.
- The action identifies the assigned persona, selects the appropriate backend (e.g., Gemini CLI), and passes the issue context.
- The action runs in a secure, ephemeral environment with codebase access.

### 3. Agent Backends
- **Gemini CLI**: The primary backend for the MVP.
- **Capabilities**: Filesystem access, shell execution, and the ability to create commits/PRs.

## The Bootstrapping Loop

1. **Human** creates an issue: "Add unit tests for the core logic."
2. **Human** labels the issue `@coder`.
3. **GitHub Action** triggers:
    - Checks out the code.
    - Invokes `gemini-cli` with the issue body as the prompt.
    - `gemini-cli` reads the code, writes tests, and pushes a branch.
4. **Conductor** (via `gh`) opens a PR and comments on the issue with the PR link.
5. **Human** reviews and merges.

## Minimal Protocol

Agents communicate through:
- **Filesystem**: The actual source code.
- **Git**: Commits and branches.
- **GitHub API**: Comments and PR descriptions.

By using the agents' native ability to understand code and documentation, we avoid the need for a brittle, hardcoded JSON protocol.
