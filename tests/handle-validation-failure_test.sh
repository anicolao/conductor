#!/usr/bin/env bash
set -euo pipefail

# tests/handle-validation-failure_test.sh

TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

export PATH="$TEST_DIR:$PATH"
export GITHUB_REPOSITORY="LLM-Orchestration/conductor"

CALL_LOG="$TEST_DIR/gh_calls"
touch "$CALL_LOG"

# Mock gh command
cat > "$TEST_DIR/gh" <<EOF
#!/usr/bin/env bash
echo "gh \$*" >> "$CALL_LOG"
case "\$*" in
  "api repos/LLM-Orchestration/conductor/pulls/123 --jq {body: .body, headRefName: .head.ref}")
    echo '{"body": "Closes #456", "headRefName": "issue-456"}'
    ;;
  "api repos/LLM-Orchestration/conductor/issues/456")
    echo '{"labels":[{"name":"persona: coder"}], "node_id": "I_456"}'
    ;;
  "api graphql"*)
    echo '{"id": "item_node_id", "project": {"id": "project_node_id"}, "status": "Human Review"}'
    ;;
  "project field-list 1 --owner LLM-Orchestration --format json")
    echo '{"fields": [{"name": "Status", "id": "status_field_id", "options": [{"name": "Todo", "id": "todo_id"}, {"name": "In Progress", "id": "in_progress_id"}]}]}'
    ;;
  "project item-edit --id item_node_id --project-id project_node_id --field-id status_field_id --single-select-option-id in_progress_id")
    exit 0
    ;;
  "issue comment 456 -R LLM-Orchestration/conductor --body"*)
    exit 0
    ;;
  *)
    echo "Mock GH called with unexpected arguments: \$*" >&2
    exit 1
    ;;
esac
EOF
chmod +x "$TEST_DIR/gh"

echo "Running handle-validation-failure.sh test..."
if bash scripts/handle-validation-failure.sh 123 LLM-Orchestration/conductor; then
  echo "Script exited successfully."
else
  echo "Script failed!"
  exit 1
fi

# Verify calls
echo "Verifying gh calls..."

if grep -q "gh project item-edit --id item_node_id --project-id project_node_id --field-id status_field_id --single-select-option-id in_progress_id" "$CALL_LOG"; then
  echo "Success: project item-edit was called correctly"
else
  echo "Error: project item-edit was NOT called correctly"
  cat "$CALL_LOG"
  exit 1
fi

if grep -q "gh issue comment 456 -R LLM-Orchestration/conductor --body" "$CALL_LOG"; then
  echo "Success: issue comment was called"
else
  echo "Error: issue comment was NOT called"
  cat "$CALL_LOG"
  exit 1
fi

echo "Test 1 passed: Successful move back to In Progress."

# Test 2: Already In Progress (should NOT call project item-edit but SHOULD call issue comment)
echo "" > "$CALL_LOG"
cat > "$TEST_DIR/gh" <<EOF
#!/usr/bin/env bash
echo "gh \$*" >> "$CALL_LOG"
case "\$*" in
  "api repos/LLM-Orchestration/conductor/pulls/124 --jq {body: .body, headRefName: .head.ref}")
    echo '{"body": "Resolves #457", "headRefName": "issue-457"}'
    ;;
  "api repos/LLM-Orchestration/conductor/issues/457")
    echo '{"labels":[{"name":"persona: conductor"}], "node_id": "I_457"}'
    ;;
  "api graphql"*)
    echo '{"id": "item_node_id_2", "project": {"id": "project_node_id"}, "status": "In Progress"}'
    ;;
  "issue comment 457 -R LLM-Orchestration/conductor --body"*)
    exit 0
    ;;
  *)
    echo "Mock GH called with unexpected arguments: \$*" >&2
    exit 1
    ;;
esac
EOF

echo "Running Test 2: Already In Progress..."
if bash scripts/handle-validation-failure.sh 124 LLM-Orchestration/conductor; then
  echo "Script exited successfully."
else
  echo "Script failed!"
  exit 1
fi

if grep -q "gh project item-edit" "$CALL_LOG"; then
  echo "Error: project item-edit should NOT have been called"
  exit 1
else
  echo "Success: project item-edit was not called"
fi

if grep -q "gh issue comment 457 -R LLM-Orchestration/conductor --body" "$CALL_LOG"; then
  echo "Success: issue comment was called"
else
  echo "Error: issue comment was NOT called"
  exit 1
fi

echo "Test 2 passed: Already In Progress handled correctly."

echo "All tests passed!"
exit 0
