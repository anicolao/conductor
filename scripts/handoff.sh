#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: npm run handoff -- TARGET < comment.md" >&2
  exit 1
fi

if [ -z "${GITHUB_EVENT_PATH:-}" ]; then
  echo "GITHUB_EVENT_PATH must be set" >&2
  exit 1
fi

target="$1"
branch_name="$(git branch --show-current)"

if [ -z "$branch_name" ]; then
  echo "Could not determine current branch" >&2
  exit 1
fi

issue_number="$(node -e "const fs=require('fs'); const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')); if (!event.issue?.number) process.exit(1); process.stdout.write(String(event.issue.number));")"

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
cat > "$body_file"

if [ ! -s "$body_file" ]; then
  echo "Comment body must be provided on stdin" >&2
  exit 1
fi

gh issue edit "$issue_number" \
  --add-label "persona: $target" \
  --add-label "branch: $branch_name"

gh issue comment "$issue_number" --body-file "$body_file"
