#!/usr/bin/env bash

set -euo pipefail

repo="${CONDUCTOR_REPO:-${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}}"
issue_number="${CONDUCTOR_ISSUE_NUMBER:?CONDUCTOR_ISSUE_NUMBER is required}"

runtime_dir=".conductor/runtime"
mkdir -p "$runtime_dir"

issue_json="$runtime_dir/issue-${issue_number}.json"
comments_json="$runtime_dir/issue-${issue_number}-comments.json"
context_path="$runtime_dir/issue-${issue_number}-context.md"

gh api "repos/$repo/issues/$issue_number" >"$issue_json"
gh api "repos/$repo/issues/$issue_number/comments?per_page=100" >"$comments_json"

python3 scripts/conductor/render_context.py \
  --comments-json "$comments_json" \
  --context-path "$context_path" \
  --event-json "${GITHUB_EVENT_PATH:?GITHUB_EVENT_PATH is required}" \
  --issue-json "$issue_json"

echo "context_path=$context_path" >>"$GITHUB_OUTPUT"
