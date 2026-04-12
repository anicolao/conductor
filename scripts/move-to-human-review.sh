#!/usr/bin/env bash
set -euo pipefail

issue_number=""
target_repo=""
project_number=""
project_url=""
issue_node_id=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --issue-number)
      issue_number="$2"
      shift 2
      ;;
    --repo)
      target_repo="$2"
      shift 2
      ;;
    --project-number)
      project_number="$2"
      shift 2
      ;;
    --project-url)
      project_url="$2"
      shift 2
      ;;
    --issue-node-id)
      issue_node_id="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$issue_number" ]; then
  if [ -z "${GITHUB_EVENT_PATH:-}" ]; then
    echo "issue number must be supplied with --issue-number or via GITHUB_EVENT_PATH" >&2
    exit 1
  fi

  issue_number="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const num = event.issue?.number || event.client_payload?.issue_number;
if (!num) process.exit(1);
process.stdout.write(String(num));
")" || {
    echo "Could not determine issue number" >&2
    exit 1
  }
fi

if [ -z "$target_repo" ]; then
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    target_repo="$GITHUB_REPOSITORY"
  elif [ -n "${GITHUB_EVENT_PATH:-}" ]; then
    target_repo="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repo = event.client_payload?.repository || '';
if (!repo) process.exit(1);
process.stdout.write(repo);
")" || {
      echo "Could not determine target repository" >&2
      exit 1
    }
  else
    echo "target repository must be supplied with --repo or via environment" >&2
    exit 1
  fi
fi

if [ -z "$project_number" ] && [ -n "${GITHUB_EVENT_PATH:-}" ]; then
  project_number="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
process.stdout.write(String(event.client_payload?.project_number || ''));
")"
fi

if [ -z "$project_url" ] && [ -n "${GITHUB_EVENT_PATH:-}" ]; then
  project_url="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
process.stdout.write(event.client_payload?.project_url || '');
")"
fi

if [ -z "$issue_node_id" ] && [ -n "${GITHUB_EVENT_PATH:-}" ]; then
  issue_node_id="$(node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
process.stdout.write(event.issue?.node_id || event.client_payload?.issue_node_id || '');
")"
fi

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

if [ ! -t 0 ]; then
  cat > "$body_file"
fi

if [ -s "$body_file" ]; then
  gh issue comment "$issue_number" -R "$target_repo" --body-file "$body_file"
fi

existing_labels="$(gh issue view "$issue_number" -R "$target_repo" --json labels --jq '.labels[].name')"
edit_args=()
while IFS= read -r label; do
  case "$label" in
    "persona: "*)
      edit_args+=(--remove-label "$label")
      ;;
  esac
done <<< "$existing_labels"

if [ "${#edit_args[@]}" -gt 0 ]; then
  gh issue edit "$issue_number" -R "$target_repo" "${edit_args[@]}"
fi

if [ -z "$project_number" ]; then
  echo "No project_number available; skipped Project V2 status update." >&2
  exit 0
fi

project_owner="$(node -e "
const url = process.argv[1] || '';
const match = url.match(/github\.com\/(orgs|users)\/([^\/]+)\/projects/);
process.stdout.write(match ? match[2] : '');
" "$project_url")"

if [ -z "$project_owner" ]; then
  echo "project_number was provided but project_owner could not be determined from project_url" >&2
  exit 1
fi

if [ -z "$issue_node_id" ]; then
  echo "Warning: issue_node_id is missing, will attempt to find project item by issue number and repository" >&2
fi

item_data="$(gh project item-list "$project_number" --owner "$project_owner" --limit 1000 --format json --jq ".items[] | select((.content.number == $issue_number and .content.repository == \"$target_repo\") or .content.id == \"$issue_node_id\")" | head -n 1)"

if [ -z "$item_data" ]; then
  echo "Could not find project item for issue $issue_number in $target_repo" >&2
  exit 1
fi

item_id="$(echo "$item_data" | jq -r '.id')"
project_id="$(gh project view "$project_number" --owner "$project_owner" --format json --jq '.id')"
fields_json="$(gh project field-list "$project_number" --owner "$project_owner" --format json)"
status_field_id="$(echo "$fields_json" | jq -r '.fields[] | select(.name == "Status") | .id' | head -n 1)"
status_option_id="$(echo "$fields_json" | jq -r '.fields[] | select(.name == "Status") | .options[] | select(.name == "Human Review") | .id' | head -n 1)"

if [ -z "$project_id" ] || [ "$project_id" = "null" ]; then
  echo "Could not resolve project ID for project $project_number" >&2
  exit 1
fi

if [ -z "$status_field_id" ] || [ "$status_field_id" = "null" ]; then
  echo "Could not find Status field in project $project_number" >&2
  exit 1
fi

if [ -z "$status_option_id" ] || [ "$status_option_id" = "null" ]; then
  echo "Could not find Human Review option in Status field" >&2
  exit 1
fi

gh project item-edit \
  --id "$item_id" \
  --project-id "$project_id" \
  --field-id "$status_field_id" \
  --single-select-option-id "$status_option_id" > /dev/null

for _ in 1 2 3 4 5; do
  current_status="$(gh project item-list "$project_number" --owner "$project_owner" --limit 1000 --format json --jq ".items[] | select(.id == \"$item_id\") | .status // empty" 2>/dev/null | head -n 1)"
  if [ "$current_status" = "Human Review" ]; then
    exit 0
  fi
  sleep 2
done

echo "Failed to verify Human Review status update for project item $item_id" >&2
exit 1
