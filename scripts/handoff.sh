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

issue_number="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const num = event.issue?.number || event.client_payload?.issue_number;
if (!num) {
  console.error('Could not find issue number in GITHUB_EVENT_PATH');
  process.exit(1);
}
process.stdout.write(String(num));
")"

current_labels() {
  gh issue view "$issue_number" --json labels --jq '.labels[].name'
}

existing_labels="$(current_labels)"

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
cat > "$body_file"

if [ ! -s "$body_file" ]; then
  echo "Comment body must be provided on stdin" >&2
  exit 1
fi

while IFS= read -r label; do
  case "$label" in
    "persona: "*)
      gh issue edit "$issue_number" --remove-label "$label"
      ;;
    "branch: "*)
      gh issue edit "$issue_number" --remove-label "$label"
      ;;
  esac
done <<< "$existing_labels"

gh issue edit "$issue_number" \
  --add-label "persona: $target" \
  --add-label "branch: $branch_name"

verified=0
for _ in 1 2 3 4 5; do
  labels_after="$(current_labels)"
  if grep -Fqx "persona: $target" <<< "$labels_after" && grep -Fqx "branch: $branch_name" <<< "$labels_after"; then
    verified=1
    break
  fi
  sleep 1
done

if [ "$verified" -ne 1 ]; then
  echo "Failed to verify handoff labels on issue $issue_number before posting comment" >&2
  exit 1
fi

gh issue comment "$issue_number" --body-file "$body_file"
