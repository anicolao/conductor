#!/usr/bin/env bash

set -euo pipefail

persona="${CONDUCTOR_PERSONA:?CONDUCTOR_PERSONA is required}"
issue_number="${CONDUCTOR_ISSUE_NUMBER:?CONDUCTOR_ISSUE_NUMBER is required}"
context_path="${CONDUCTOR_CONTEXT_PATH:?CONDUCTOR_CONTEXT_PATH is required}"
prompt_path="${CONDUCTOR_PROMPT_PATH:?CONDUCTOR_PROMPT_PATH is required}"
repo="${CONDUCTOR_REPO:-${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}}"
default_branch="${CONDUCTOR_DEFAULT_BRANCH:-main}"
model="${CONDUCTOR_GEMINI_MODEL:-gemini-2.5-pro}"

if [[ ! -f "$context_path" ]]; then
  printf 'Context file not found: %s\n' "$context_path" >&2
  exit 1
fi

if [[ ! -f "$prompt_path" ]]; then
  printf 'Persona prompt not found: %s\n' "$prompt_path" >&2
  exit 1
fi

if [[ -z "${GEMINI_API_KEY:-}" && -z "${GOOGLE_API_KEY:-}" ]]; then
  echo "Gemini CLI credentials are missing. Set GEMINI_API_KEY or GOOGLE_API_KEY." >&2
  exit 1
fi

runtime_dir=".conductor/runtime"
mkdir -p "$runtime_dir"

run_prompt_path="$runtime_dir/run-${persona}-issue-${issue_number}.md"
response_path="$runtime_dir/run-${persona}-issue-${issue_number}-response.json"

cat >"$run_prompt_path" <<EOF
You are running inside the Conductor MVP GitHub Actions workflow.

This run is for repository \`$repo\`, issue \`#$issue_number\`, on the \`$default_branch\` default branch.

Read and follow the persona instructions below as the authoritative operating contract for this run:

$(cat "$prompt_path")

Also read the generated issue context file at \`$context_path\` before acting.

Execution requirements:

- Work end-to-end without asking for human input.
- Inspect the repository directly before making decisions.
- Use \`git\`, \`gh\`, and local tools as needed.
- Use the helper scripts in \`scripts/conductor/\` for persona label changes and PR creation when they fit.
- When handing off, update the persona label first and then post the comment that should trigger the next run.
- If you finish a verified implementation as \`@conductor\`, clear persona labels after opening the PR.
- Print a short final summary to stdout in addition to any GitHub side effects.
EOF

gemini \
  --approval-mode=yolo \
  --model "$model" \
  --output-format json \
  --sandbox=false \
  --prompt "$(cat "$run_prompt_path")" | tee "$response_path"
