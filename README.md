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

This repository now includes a first working MVP implementation of the design in [MVP_DESIGN.md](MVP_DESIGN.md):

- A GitHub Actions workflow at `.github/workflows/conductor.yml` that triggers on new issues and issue comments.
- Persona routing based on `persona: conductor` / `persona: coder` labels, with `@conductor` mention fallback when no persona label exists.
- Persona-specific prompts in `.github/prompts/`.
- A repository-level `GEMINI.md` file that gives Gemini CLI the project context it should always follow.
- A small Python router at `scripts/conductor/router.py` that resolves the active persona and assembles the prompt context from the repository markdown and issue thread.

### Required repository secrets

To run the workflow in GitHub Actions, configure:

- `GEMINI_API_KEY`: Gemini API key for the Gemini CLI action.
- `CONDUCTOR_GH_TOKEN` (recommended): a token that can comment, manage labels, create pull requests, and trigger follow-up workflow runs during persona handoffs.

## Licensing

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details.
