#!/usr/bin/env bash
set -euo pipefail

# This script checks for unauthorized modifications in src/, functions/, and tests/.
# It should be run to ensure the conductor persona has not modified restricted files.

forbidden_dirs=("src" "functions" "tests")

echo "Running conductor verification..."

# If CONDUCTOR_TARGET_DIR is set, we need to check THAT directory, not the current one.
if [ -n "${CONDUCTOR_TARGET_DIR:-}" ]; then
  cd "$CONDUCTOR_TARGET_DIR"
  echo "Checking target directory: $CONDUCTOR_TARGET_DIR"
fi

# Check for uncommitted changes (including untracked files) in forbidden directories
# We use 'git status --porcelain' to catch both modified and untracked files.
uncommitted_changes=$(git status --porcelain -- "${forbidden_dirs[@]}" | awk '{print $2}')

if [ -n "$uncommitted_changes" ]; then
  echo "Error: Unauthorized uncommitted changes detected in forbidden directories:" >&2
  echo "$uncommitted_changes" >&2
  exit 1
fi

echo "Conductor verification successful: No unauthorized uncommitted changes detected."
