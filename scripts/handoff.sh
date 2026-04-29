#!/usr/bin/env bash
# This script handles the handoff process between personas (e.g., conductor, coder, human).
# It ensures:
# 1. Label updates (persona: and branch:) are performed and verified BEFORE any comments are posted.
# 2. Only one 'persona:' label and one 'branch:' label remain active on the issue.
# 3. If a project is associated, the 'Persona' field in Project V2 is also updated and verified.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/handoff-utils.sh"

if [ "$#" -lt 2 ]; then
  echo "Usage: npm run handoff -- TARGET COMMIT_COUNT < comment.md" >&2
  exit 1
fi

target="$1"
claimed_commits="$2"

# Resolve issue, repo, project info
resolve_github_context

# Git validation and push
validate_git_state "$claimed_commits"

# Ensure we are on the correct branch for the issue
if [ "$branch_name" = "main" ]; then
  branch_name="issue-$issue_number"
  git checkout "$branch_name" 2>/dev/null || git checkout -b "$branch_name"
fi

# Create branch label if it doesn't exist and we are not on main, and the branch is pushed to origin
if [ "$branch_name" != "main" ] && git rev-parse --verify "origin/$branch_name" >/dev/null 2>&1; then
  # Use a subshell to avoid exit on failure if label list fails for some reason
  if ! (gh api --paginate "repos/$target_repo/labels" --jq '.[].name' | grep -qx "branch: $branch_name") 2>/dev/null; then
    echo "Creating missing label 'branch: $branch_name'..."
    gh api "repos/$target_repo/labels" -X POST -f name="branch: $branch_name" -f color="CCCCCC" -f description="Active branch for this issue" >/dev/null 2>&1 || true
  fi
fi

current_labels() {
  gh api "repos/$target_repo/issues/$issue_number" --jq '.labels[].name'
}

existing_labels="$(current_labels)"

# Conductor Guardrail: Verify no unauthorized changes if current persona is conductor
current_persona=$(echo "$existing_labels" | grep "^persona: " | head -n 1 | cut -d' ' -f2 || true)
if [ "$current_persona" == "conductor" ]; then
  verify_script="${CONDUCTOR_ROOT:-.}/scripts/conductor-verify.sh"
  if [ -f "$verify_script" ]; then
    bash "$verify_script"
  else
    # Fallback for local dev or transition
    if [ -f "$SCRIPT_DIR/conductor-verify.sh" ]; then
      bash "$SCRIPT_DIR/conductor-verify.sh"
    else
      echo "Warning: conductor-verify.sh not found, skipping verification" >&2
    fi
  fi
fi

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

persona="${CONDUCTOR_PERSONA:-human}"
if [ -n "${CONDUCTOR_LAST_COMMENT_URL:-}" ]; then
  comment_id="${CONDUCTOR_LAST_COMMENT_URL##*-}"
  echo "I am the **$persona**, and I am responding to comment [$comment_id]($CONDUCTOR_LAST_COMMENT_URL) on branch $branch_name." > "$body_file"
else
  issue_url="$(gh api "repos/$target_repo/issues/$issue_number" --jq .html_url)"
  echo "I am the **$persona**, and I am responding to the [original issue]($issue_url) on branch $branch_name." > "$body_file"
fi
echo "" >> "$body_file"

cat >> "$body_file"

if [ ! -s "$body_file" ]; then
  echo "Comment body must be provided on stdin" >&2
  exit 1
fi

# Strip local media path markers that might have been repeated by the LLM
# This prevents broken image tags in GitHub comments.
strip_local_media_markers "$body_file"

edit_args=()
while IFS= read -r label; do
  case "$label" in
    "persona: "*)
      if [ "$target" == "human" ] || [ "$label" != "persona: $target" ]; then
        edit_args+=(--remove-label "$label")
      fi
      ;;
    "branch: "*)
      if [ "$label" != "branch: $branch_name" ]; then
        edit_args+=(--remove-label "$label")
      fi
      ;;
  esac
done <<< "$existing_labels"

if [ "$target" == "human" ]; then
  gh issue edit "$issue_number" -R "$target_repo" \
    "${edit_args[@]}" \
    --add-label "branch: $branch_name"
else
  gh issue edit "$issue_number" -R "$target_repo" \
    "${edit_args[@]}" \
    --add-label "persona: $target" \
    --add-label "branch: $branch_name"
fi

verified=0
for _ in 1 2 3 4 5; do
  labels_after="$(current_labels)"
  if [ "$target" == "human" ]; then
    if ! grep -Fq "persona: " <<< "$labels_after" && grep -Fqx "branch: $branch_name" <<< "$labels_after"; then
      verified=1
      break
    fi
  else
    if grep -Fqx "persona: $target" <<< "$labels_after" && grep -Fqx "branch: $branch_name" <<< "$labels_after"; then
      verified=1
      break
    fi
  fi
  sleep 1
done

if [ "$verified" -ne 1 ]; then
  echo "Failed to verify handoff labels on issue $issue_number in $target_repo before posting comment" >&2
  exit 1
fi

gh issue comment "$issue_number" -R "$target_repo" --body-file "$body_file"

# Update Project V2 Persona field if project info is available
if [ -n "$project_number" ] && [ "$target" != "human" ]; then
  update_project_v2_field "Persona" "$target" ".persona"
fi
