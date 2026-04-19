#!/usr/bin/env bash
set -euo pipefail

# Helper script to format commit messages with the issue number.
# Usage: ./scripts/commit.sh <issue_number> "<commit_message>"

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <issue_number> <commit_message>"
  echo "Example: $0 155 \"Initial commit\""
  exit 1
fi

ISSUE_NUMBER=$1
shift
COMMIT_MESSAGE="$*"

git commit -m "[#${ISSUE_NUMBER}] ${COMMIT_MESSAGE}"
