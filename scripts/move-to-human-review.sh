#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/handoff-utils.sh"

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 COMMIT_COUNT [--issue-number NUM] [--repo REPO] ..." >&2
  exit 1
fi

claimed_commits="$1"
shift

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

# Resolve issue, repo, project info
resolve_github_context

# Git validation and push
validate_git_state "$claimed_commits"

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

if [ -n "${CONDUCTOR_PERSONA:-}" ] && [ -n "${CONDUCTOR_LAST_COMMENT_URL:-}" ]; then
  comment_id="${CONDUCTOR_LAST_COMMENT_URL##*-}"
  echo "I am the **$CONDUCTOR_PERSONA**, and I am responding to comment [$comment_id]($CONDUCTOR_LAST_COMMENT_URL) on branch ${branch_name:-unknown}." > "$body_file"
  echo "" >> "$body_file"
fi

if [ ! -t 0 ]; then
  cat >> "$body_file"
fi

if [ -s "$body_file" ]; then
  # Strip local media path markers that might have been repeated by the LLM
  # This prevents broken image tags in GitHub comments.
  strip_local_media_markers "$body_file"
  
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

# Update Project V2 Status field if project info is available
if [ -n "$project_number" ]; then
  update_project_v2_field "Status" "Human Review" ".status"
else
  echo "No project_number available; skipped Project V2 status update." >&2
fi
