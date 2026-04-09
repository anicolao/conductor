#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 ISSUE_NUMBER BRANCH_NAME BODY_FILE" >&2
  exit 1
fi

issue_number="$1"
branch_name="$2"
body_file="$3"

if [ -z "$branch_name" ]; then
  echo "Branch name must not be empty" >&2
  exit 1
fi

if [ ! -f "$body_file" ]; then
  echo "Comment body file not found: $body_file" >&2
  exit 1
fi

gh issue edit "$issue_number" \
  --add-label "persona: coder" \
  --add-label "branch: $branch_name"

gh issue comment "$issue_number" --body-file "$body_file"
