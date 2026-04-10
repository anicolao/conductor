# Conductor

Conductor is an LLM coordination framework designed to facilitate complex software engineering tasks by orchestrating multiple specialized AI agents. It represents the third iteration of a vision that began with **Morpheum** and **Overseer**.

## Philosophy

Conductor aims for extreme simplicity and high agency. Instead of complex, hardcoded JSON protocols and rigid guardrails, Conductor leverages existing powerful coding agents (like Gemini CLI) and integrates them into a standard software development lifecycle using GitHub Actions and Issues.

## Key Features

- **Agentic Handoff**: Seamlessly transfer tasks between specialized personas.
- **Bootstrapping**: Designed to work on its own codebase from day one.
- **GitHub-Native**: Uses Issues for state tracking and Actions for execution.
- **Agent Agnostic**: Supports any CLI-based agent that can interact with a codebase.

## Gemini Setup

This MVP invokes the official Gemini CLI through `npx` in headless mode.

- For GitHub Actions, set the repository secret `GEMINI_API_KEY`.
- For local runs, copy `.env.example` to `.env` and set `GEMINI_API_KEY`.

## Projects V2 Setup

The live shared board is the organization-owned project at:

- `https://github.com/orgs/LLM-Orchestration/projects/1`

Project moves do not trigger GitHub Actions directly. Conductor uses an org-project bridge:

1. An organization webhook or GitHub App observes `projects_v2_item`.
2. The bridge sends `repository_dispatch` with `event_type=project_in_progress`.
3. The workflow starts and activates `persona: conductor` on the target issue.

See [PROJECTS_V2_INTEGRATION.md](PROJECTS_V2_INTEGRATION.md) for the exact dispatch contract and setup details.

## Licensing

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details.
