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

# Extract issue number and repository from GITHUB_EVENT_PATH
issue_data="$(node -e "
const fs = require('fs');
const eventPath = process.env.GITHUB_EVENT_PATH;
if (!fs.existsSync(eventPath)) process.exit(1);
const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const num = event.issue?.number || event.client_payload?.issue_number;
const repo = event.client_payload?.repository || process.env.GITHUB_REPOSITORY;
if (!num || !repo) {
  process.exit(1);
}
console.log(JSON.stringify({issue_number: String(num), repository: repo}));
")"

if [ -z "$issue_data" ]; then
  echo "Could not find issue number or repository in GITHUB_EVENT_PATH" >&2
  exit 1
fi

issue_number="$(echo "$issue_data" | jq -r '.issue_number')"
repository="$(echo "$issue_data" | jq -r '.repository')"

current_labels() {
  gh issue view "$issue_number" -R "$repository" --json labels --jq '.labels[].name'
}

existing_labels="$(current_labels)"

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
cat > "$body_file"

if [ ! -s "$body_file" ]; then
  echo "Comment body must be provided on stdin" >&2
  exit 1
fi

# Ensure branch label exists in the repository
branch_label="branch: $branch_name"
if ! gh label list -R "$repository" --search "$branch_label" | grep -q "^$branch_label"; then
  echo "Creating missing label: $branch_label"
  gh label create "$branch_label" -R "$repository" --color FFFFFF --description "Active branch for this issue" || true
fi

# Prepare atomic label edit
remove_labels=()
while IFS= read -r label; do
  if [ -z "$label" ]; then continue; fi
  case "$label" in
    "persona: "*)
      remove_labels+=("--remove-label" "$label")
      ;;
    "branch: "*)
      remove_labels+=("--remove-label" "$label")
      ;;
  esac
done <<< "$existing_labels"

echo "Updating labels on ${repository}#${issue_number}..."
gh issue edit "$issue_number" -R "$repository" \
  "${remove_labels[@]}" \
  --add-label "persona: $target" \
  --add-label "$branch_label"

# Verification
verified=0
for i in 1 2 3 4 5; do
  labels_after="$(current_labels)"
  if grep -Fqx "persona: $target" <<< "$labels_after" && grep -Fqx "$branch_label" <<< "$labels_after"; then
    verified=1
    break
  fi
  echo "Waiting for label propagation (attempt $i)..."
  sleep 1
done

if [ "$verified" -ne 1 ]; then
  echo "Failed to verify handoff labels on issue ${repository}#${issue_number} before posting comment" >&2
  exit 1
fi

echo "Posting comment to ${repository}#${issue_number}..."
gh issue comment "$issue_number" -R "$repository" --body-file "$body_file"
