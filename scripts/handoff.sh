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

target_repo="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repo = event.client_payload?.repository || process.env.GITHUB_REPOSITORY;
if (!repo) {
  console.error('Could not find repository in event or environment');
  process.exit(1);
}
process.stdout.write(repo);
")"

current_labels() {
  gh issue view "$issue_number" -R "$target_repo" --json labels --jq '.labels[].name'
}

existing_labels="$(current_labels)"

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
cat > "$body_file"

if [ ! -s "$body_file" ]; then
  echo "Comment body must be provided on stdin" >&2
  exit 1
fi

edit_args=()
while IFS= read -r label; do
  case "$label" in
    "persona: "*)
      edit_args+=(--remove-label "$label")
      ;;
    "branch: "*)
      edit_args+=(--remove-label "$label")
      ;;
  esac
done <<< "$existing_labels"

gh issue edit "$issue_number" -R "$target_repo" \
  "${edit_args[@]}" \
  --add-label "persona: $target" \
  --add-label "branch: $branch_name"

# Update Project V2 Persona field if project info is available
project_owner="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const url = event.client_payload?.project_url || '';
const match = url.match(/github\.com\/orgs\/([^\/]+)\/projects/);
process.stdout.write(match ? match[1] : 'LLM-Orchestration');
")"
project_number="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
process.stdout.write(String(event.client_payload?.project_number || '1'));
")"
issue_node_id="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
process.stdout.write(event.issue?.node_id || event.client_payload?.issue_node_id || '');
")"

if [ -n "$issue_node_id" ] && [ -n "$project_number" ]; then
  echo "Finding project item for issue node ID: $issue_node_id in project $project_number"
  item_data=$(gh project item-list "$project_number" --owner "$project_owner" --format json --jq ".items[] | select(.content.id == \"$issue_node_id\")" 2>/dev/null || true)
  
  if [ -n "$item_data" ]; then
    item_id=$(echo "$item_data" | jq -r '.id')
    project_id=$(gh project view "$project_number" --owner "$project_owner" --format json --jq '.id' 2>/dev/null || true)
    
    if [ -n "$project_id" ]; then
      echo "Resolving Persona field and option IDs..."
      fields_json=$(gh project field-list "$project_number" --owner "$project_owner" --format json)
      field_id=$(echo "$fields_json" | jq -r ".fields[] | select(.name == \"Persona\") | .id")
      
      if [ -n "$field_id" ] && [ "$field_id" != "null" ]; then
        option_id=$(echo "$fields_json" | jq -r ".fields[] | select(.name == \"Persona\") | .options[] | select(.name == \"$target\") | .id")
        
        if [ -n "$option_id" ] && [ "$option_id" != "null" ]; then
          echo "Updating Project V2 item $item_id Persona to $target ($option_id)"
          gh project item-edit --id "$item_id" --project-id "$project_id" --field-id "$field_id" --single-select-option-id "$option_id" > /dev/null
        else
          echo "Warning: Could not find option ID for persona '$target' in 'Persona' field"
        fi
      else
        echo "Warning: Could not find 'Persona' field in project $project_number"
      fi
    fi
  else
    echo "Warning: Could not find project item for issue node ID $issue_node_id"
  fi
fi

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
  echo "Failed to verify handoff labels on issue $issue_number in $target_repo before posting comment" >&2
  exit 1
fi

gh issue comment "$issue_number" -R "$target_repo" --body-file "$body_file"
