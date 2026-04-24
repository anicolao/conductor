# Conductor

Conductor is an LLM coordination framework designed to facilitate complex software engineering tasks by orchestrating multiple specialized AI agents. It represents the third iteration of a vision that began with **Morpheum** and **Overseer**.

## Philosophy

Conductor aims for extreme simplicity and high agency. Instead of complex, hardcoded JSON protocols and rigid guardrails, Conductor leverages existing powerful coding agents (like Gemini CLI) and integrates them into a standard software development lifecycle using GitHub Actions and Issues.

## Key Features

- **Agentic Handoff**: Seamlessly transfer tasks between specialized personas.
- **Bootstrapping**: Designed to work on its own codebase from day one.
- **GitHub-Native**: Uses Issues for state tracking and Actions for execution.
- **Structured Observability**: Real-time visibility into agent internal states via a SvelteKit-based UI (`observability-ui/`) and high-fidelity JSON event parsing.
- **Orchestration Guardrails**: Built-in protections that keep the `conductor` persona focused on high-level planning and verification, preventing unauthorized source modification.
- **Rigorous E2E Standards**: Zero-pixel tolerance and deterministic Playwright testing using a Unified Step Pattern (see [E2E_GUIDE.md](E2E_GUIDE.md)).
- **Agent Agnostic**: Supports any CLI-based agent that can interact with a codebase.

## Gemini Setup

This MVP invokes the official Gemini CLI through `npx` in headless mode. We utilize `-o stream-json` for high-fidelity tool tracking and real-time observability.

- For GitHub Actions, set either:
  - `GEMINI_OAUTH_CREDS_JSON` to the full contents of `~/.gemini/oauth_creds.json`
  - or `GEMINI_API_KEY` as a fallback
- The Conductor workflow also sets `GEMINI_CLI_TRUST_WORKSPACE=true` so Gemini CLI can run non-interactively in the checked-out target repository.
- The conductor workflow pre-seeds `~/.gemini/projects.json` on the runner to avoid the upstream `ProjectRegistry.save()` bootstrap race on fresh environments.
- For local runs, either authenticate Gemini CLI so `~/.gemini/oauth_creds.json` exists, or copy `.env.example` to `.env` and set `GEMINI_API_KEY`.

## Projects V2 Setup

The live shared board is the organization-owned project at:

- `https://github.com/orgs/LLM-Orchestration/projects/1`

Project moves do not trigger GitHub Actions directly. Conductor uses an org-project bridge:

1. An organization webhook or GitHub App observes `projects_v2_item`.
2. The bridge sends `repository_dispatch` with `event_type=project_in_progress`, including the source repository in the payload.
3. The workflow starts and activates `persona: conductor` on the target issue in any repository within the organization.

The bridge in this repository is deployed as a Firebase HTTPS function.

See [PROJECTS_V2_INTEGRATION.md](PROJECTS_V2_INTEGRATION.md) for the exact dispatch contract and setup details.

Current Firebase bridge project:

- `llm-orch-conductor-bridge`

The repository also includes a Firebase scheduled recovery function that triggers the existing `recover-orphaned-items.yml` workflow on staggered minutes.
During the transition, the GitHub workflow keeps its own native cron as well, so both schedulers can exercise the same recovery path.
You can exercise the same scanner without re-triggering work via `npm run recover:orphans:dry-run`.

## Licensing

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details.
