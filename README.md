# Conductor

Conductor is an LLM coordination framework designed to facilitate complex software engineering tasks by orchestrating multiple specialized AI agents. It represents the third iteration of a vision that began with **Morpheum** and **Overseer**.

## Philosophy

Conductor aims for extreme simplicity and high agency. Instead of complex, hardcoded JSON protocols and rigid guardrails, Conductor leverages existing powerful coding agents (like Gemini CLI) and integrates them into a standard software development lifecycle using GitHub Actions and Issues.

## Key Features

- **Agentic Handoff**: Seamlessly transfer tasks between specialized personas.
- **Bootstrapping**: Designed to work on its own codebase from day one.
- **GitHub-Native**: Uses Issues for state tracking and Actions for execution.
- **Agent Agnostic**: Supports any CLI-based agent that can interact with a codebase.

## MVP Implementation

This repository now includes the MVP described in [`MVP_DESIGN.md`](MVP_DESIGN.md):

- a GitHub Actions workflow that triggers on issue creation and new issue comments
- persona routing via `persona: conductor` and `persona: coder` labels
- persona prompts for orchestration and implementation
- helper scripts for context generation, label handoff, and PR creation

## Repository Layout

- `.github/workflows/conductor.yml`: entrypoint workflow
- `.github/prompts/`: persona instructions loaded into Gemini CLI runs
- `scripts/conductor/`: runtime helpers used by both the workflow and the personas
- `GEMINI.md`: repository-level Gemini context

## Required GitHub Configuration

The workflow expects:

- Actions to have `contents`, `issues`, and `pull-requests` write permissions
- one of these repository secrets:
  - `GEMINI_API_KEY`
  - `GOOGLE_API_KEY`
- optional repository variable:
  - `CONDUCTOR_GEMINI_MODEL`
    - defaults to `gemini-2.5-pro` when unset

## How the Loop Works

1. A user opens an issue and mentions `@conductor`.
2. The workflow resolves the active persona from the `persona:` labels, or falls back to the `@conductor` mention if no persona label exists.
3. The workflow builds an issue context file from the issue body, labels, and comment history.
4. Gemini CLI runs as the active persona and uses GitHub comments plus persona labels to hand off to the next step.
5. `@conductor` opens the PR after verification and clears the persona labels.

## Notes

- The MVP injects persona instructions through the run prompt while keeping Gemini CLI's built-in system prompt intact. This is a deliberate implementation choice so the agent keeps its default tool behavior in CI.
- The workflow configures Gemini CLI for non-interactive CI execution and disables the Gemini sandbox explicitly because the agent needs direct access to `git`, `gh`, and the checked-out repository.

## Licensing

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details.
