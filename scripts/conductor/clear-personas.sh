#!/usr/bin/env bash

set -euo pipefail

if (($# != 1)); then
  echo "Usage: clear-personas.sh <issue-number>" >&2
  exit 1
fi

issue_number="$1"
repo="${CONDUCTOR_REPO:-${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}}"

mapfile -t current_persona_labels < <(
  gh issue view "$issue_number" --repo "$repo" --json labels --jq '.labels[].name' | grep '^persona: ' || true
)

if ((${#current_persona_labels[@]} == 0)); then
  exit 0
fi

remove_args=()
for label in "${current_persona_labels[@]}"; do
  remove_args+=(--remove-label "$label")
done

gh issue edit "$issue_number" --repo "$repo" "${remove_args[@]}" >/dev/null
