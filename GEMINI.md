# Conductor Repository Context

Conductor is a GitHub-native coordination framework. This repository implements the minimal loop described in `MVP_DESIGN.md`.

## Repository map

- `.github/workflows/conductor.yml`: GitHub Actions entrypoint.
- `.github/prompts/`: persona instructions for `@conductor` and `@coder`.
- `scripts/conductor/`: helper scripts used by the workflow and the personas.

## Implementation guidance

- Keep the runtime simple and inspectable.
- Prefer Bash, `gh`, `jq`, and Python standard library over heavier dependencies.
- Preserve the label-driven handoff loop:
  - `persona: conductor`
  - `persona: coder`
- Keep GitHub state explicit. Labels and comments are the source of truth for routing.
