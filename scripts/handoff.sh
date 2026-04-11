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

# In CI (Actions), git branch --show-current might be empty due to detached HEAD.
if [ -z "$branch_name" ]; then
  branch_name="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-}}"
fi

# Fallback to rev-parse if still empty
if [ -z "$branch_name" ]; then
  branch_name="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
fi

if [ -z "$branch_name" ] || [ "$branch_name" = "HEAD" ]; then
  echo "Could not determine current branch" >&2
  exit 1
fi

# Extract issue number, repository, item_id, and project_number from GITHUB_EVENT_PATH
issue_data="$(node -e "
const fs = require('fs');
const eventPath = process.env.GITHUB_EVENT_PATH;
if (!fs.existsSync(eventPath)) process.exit(1);
const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const num = event.issue?.number || event.client_payload?.issue_number;
const repo = event.client_payload?.repository || process.env.GITHUB_REPOSITORY;
const itemId = event.client_payload?.item_id;
const projectNum = event.client_payload?.project_number;
if (!num || !repo) {
  process.exit(1);
}
console.log(JSON.stringify({
  issue_number: String(num), 
  repository: repo,
  item_id: itemId || '',
  project_number: projectNum ? String(projectNum) : ''
}));
")"

if [ -z "$issue_data" ]; then
  echo "Could not find issue number or repository in GITHUB_EVENT_PATH" >&2
  exit 1
fi

issue_number="$(echo "$issue_data" | jq -r '.issue_number')"
repository="$(echo "$issue_data" | jq -r '.repository')"
item_id="$(echo "$issue_data" | jq -r '.item_id')"
project_number="$(echo "$issue_data" | jq -r '.project_number')"

if [ -z "$item_id" ] || [ -z "$project_number" ]; then
  echo "Warning: item_id or project_number missing from payload. Project field update will be skipped." >&2
fi

current_labels() {
  gh issue view "$issue_number" -R "$repository" --json labels --jq '.labels[].name'
}

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
cat > "$body_file"

if [ ! -s "$body_file" ]; then
  echo "Comment body must be provided on stdin" >&2
  exit 1
fi

# 1. Post Comment First
echo "Posting comment to ${repository}#${issue_number}..."
comment_url="$(gh issue comment "$issue_number" -R "$repository" --body-file "$body_file")"
echo "Comment posted: $comment_url"

# 2. Verify Comment Visibility
echo "Verifying comment visibility..."
# Extract comment ID from URL: https://github.com/owner/repo/issues/123#issuecomment-123456789
comment_id="${comment_url##*issuecomment-}"
if [[ "$comment_id" =~ ^[0-9]+$ ]]; then
  # Verify via API
  if ! gh api "repos/$repository/issues/comments/$comment_id" > /dev/null; then
    echo "Error: Posted comment $comment_id is not visible via API" >&2
    exit 1
  fi
  echo "Comment $comment_id verified."
else
  echo "Warning: Could not extract comment ID from $comment_url. Skipping API verification." >&2
fi

# 3. Update Labels
existing_labels="$(current_labels)"

# Ensure branch label exists in the repository
branch_label="branch: $branch_name"
if ! gh label list -R "$repository" --json name --jq '.[].name' | grep -Fqx "$branch_label"; then
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
if [ ${#remove_labels[@]} -gt 0 ]; then
  gh issue edit "$issue_number" -R "$repository" \
    "${remove_labels[@]}" \
    --add-label "persona: $target" \
    --add-label "$branch_label"
else
  gh issue edit "$issue_number" -R "$repository" \
    --add-label "persona: $target" \
    --add-label "$branch_label"
fi

# 4. Update Project Persona (Final Step)
if [ -n "$item_id" ] && [ -n "$project_number" ]; then
  echo "Updating project persona to $target..."
  # We need the project owner. If repository is owner/repo, owner is the first part.
  # But for projects it might be an organization.
  project_owner="${repository%%/*}"
  
  gh project item-edit --id "$item_id" --field "Persona" --value "$target" --project-id "" > /dev/null 2>&1 || {
    # If project-id is needed, we might have a problem as we don't have it.
    # However, 'gh project item-edit --id' usually works with just the item ID.
    # Let's try without --project-id first.
    gh project item-edit --id "$item_id" --field "Persona" --value "$target"
  }
fi

