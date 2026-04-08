#!/usr/bin/env bash

set -euo pipefail

if (($# < 3 || $# > 4)); then
  echo "Usage: open-pr.sh <branch> <title> <body-file> [base-branch]" >&2
  exit 1
fi

branch="$1"
title="$2"
body_file="$3"
base_branch="${4:-${CONDUCTOR_DEFAULT_BRANCH:-main}}"
repo="${CONDUCTOR_REPO:-${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}}"

if [[ ! -f "$body_file" ]]; then
  printf 'PR body file not found: %s\n' "$body_file" >&2
  exit 1
fi

existing_url="$(gh pr list --repo "$repo" --head "$branch" --json url --jq '.[0].url // empty')"
if [[ -n "$existing_url" ]]; then
  printf '%s\n' "$existing_url"
  exit 0
fi

gh pr create \
  --base "$base_branch" \
  --body-file "$body_file" \
  --head "$branch" \
  --repo "$repo" \
  --title "$title"
