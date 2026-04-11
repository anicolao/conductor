#!/usr/bin/env bash
set -euo pipefail

# This script checks for unauthorized modifications in src/, functions/, and tests/.
# It should be run to ensure the conductor persona has not modified restricted files.

forbidden_dirs=("src" "functions" "tests")
base_branch="main"

echo "Running conductor verification..."

# 1. Check for uncommitted changes (including untracked files) in forbidden directories
# Use --name-only to just get the file paths
uncommitted_changes=$(git status --porcelain -- "${forbidden_dirs[@]}" | awk '{print $2}')

if [ -n "$uncommitted_changes" ]; then
  echo "Error: Unauthorized uncommitted changes detected in forbidden directories:" >&2
  echo "$uncommitted_changes" >&2
  exit 1
fi

# 2. Check for committed changes vs main in forbidden directories
current_branch=$(git branch --show-current)

if [ "$current_branch" != "$base_branch" ]; then
  # Make sure main exists locally for comparison, if not we might need to fetch it
  if ! git rev-parse --verify "$base_branch" >/dev/null 2>&1; then
    echo "Warning: $base_branch not found locally, attempting to fetch..." >&2
    git fetch origin "$base_branch":"$base_branch" || {
      echo "Error: Could not find or fetch $base_branch for comparison." >&2
      exit 1
    }
  fi

  committed_changes=$(git diff --name-only "$base_branch...$current_branch" -- "${forbidden_dirs[@]}")
  if [ -n "$committed_changes" ]; then
    echo "Error: Unauthorized committed changes detected in forbidden directories (vs $base_branch):" >&2
    echo "$committed_changes" >&2
    exit 1
  fi
fi

echo "Conductor verification successful: No unauthorized changes detected."
