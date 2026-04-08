#!/usr/bin/env bash

set -euo pipefail

if (($# != 2)); then
  echo "Usage: set-persona.sh <issue-number> <conductor|coder>" >&2
  exit 1
fi

issue_number="$1"
persona="$2"
repo="${CONDUCTOR_REPO:-${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}}"

case "$persona" in
  conductor)
    target_label="persona: conductor"
    ;;
  coder)
    target_label="persona: coder"
    ;;
  *)
    printf 'Unsupported persona: %s\n' "$persona" >&2
    exit 1
    ;;
esac

gh api --method POST "repos/$repo/labels" \
  -f name="persona: conductor" \
  -f color="0e8a16" \
  -f description="Routes the next Conductor run to the @conductor persona" >/dev/null 2>&1 || true

gh api --method POST "repos/$repo/labels" \
  -f name="persona: coder" \
  -f color="1d76db" \
  -f description="Routes the next Conductor run to the @coder persona" >/dev/null 2>&1 || true

mapfile -t current_persona_labels < <(
  gh issue view "$issue_number" --repo "$repo" --json labels --jq '.labels[].name' | grep '^persona: ' || true
)

if ((${#current_persona_labels[@]} > 0)); then
  remove_args=()
  for label in "${current_persona_labels[@]}"; do
    remove_args+=(--remove-label "$label")
  done
  gh issue edit "$issue_number" --repo "$repo" "${remove_args[@]}" >/dev/null
fi

gh issue edit "$issue_number" --repo "$repo" --add-label "$target_label" >/dev/null
