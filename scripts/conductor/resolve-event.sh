#!/usr/bin/env bash

set -euo pipefail

event_path="${GITHUB_EVENT_PATH:?GITHUB_EVENT_PATH is required}"
event_name="${GITHUB_EVENT_NAME:?GITHUB_EVENT_NAME is required}"

issue_number="$(jq -r '.issue.number // .number // empty' "$event_path")"
if [[ -z "$issue_number" ]]; then
  echo "Could not determine issue number from event payload." >&2
  exit 1
fi

mapfile -t persona_labels < <(
  jq -r '.issue.labels[]?.name // empty' "$event_path" | grep '^persona: ' || true
)

if ((${#persona_labels[@]} > 1)); then
  printf 'Multiple persona labels found: %s\n' "${persona_labels[*]}" >&2
  exit 1
fi

persona=""
should_run="false"
reason="filtered"

if ((${#persona_labels[@]} == 1)); then
  case "${persona_labels[0]}" in
    "persona: conductor")
      persona="conductor"
      should_run="true"
      reason="label"
      ;;
    "persona: coder")
      persona="coder"
      should_run="true"
      reason="label"
      ;;
    *)
      printf 'Unsupported persona label: %s\n' "${persona_labels[0]}" >&2
      exit 1
      ;;
  esac
else
  trigger_text=""
  trigger_kind=""

  case "$event_name" in
    issues)
      trigger_kind="issue_opened"
      trigger_text="$(jq -r '.issue.body // ""' "$event_path")"
      ;;
    issue_comment)
      trigger_kind="comment_created"
      trigger_text="$(jq -r '.comment.body // ""' "$event_path")"
      ;;
    *)
      printf 'Unsupported event name: %s\n' "$event_name" >&2
      exit 1
      ;;
  esac

  if grep -Eiq '(^|[^[:alnum:]_-])@conductor([^[:alnum:]_-]|$)' <<<"$trigger_text"; then
    persona="conductor"
    should_run="true"
    reason="mention"
  fi
fi

case "$event_name" in
  issues)
    trigger_kind="issue_opened"
    ;;
  issue_comment)
    trigger_kind="comment_created"
    ;;
  *)
    printf 'Unsupported event name: %s\n' "$event_name" >&2
    exit 1
    ;;
esac

{
  echo "issue_number=$issue_number"
  echo "persona=$persona"
  echo "reason=$reason"
  echo "should_run=$should_run"
  echo "trigger_kind=$trigger_kind"
} >>"$GITHUB_OUTPUT"
