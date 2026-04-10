#!/usr/bin/env bash
set -euo pipefail

# This script tests handoff.sh failure modes by mocking the 'gh' command.

# Create a temporary directory for our test environment
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

# Set up environment for handoff.sh
export PATH="$TEST_DIR:$PATH"
export GITHUB_EVENT_PATH="$TEST_DIR/event.json"
export GITHUB_REPOSITORY="LLM-Orchestration/conductor"

# Create a dummy event.json with project info
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 123,
    "project_number": 1,
    "project_url": "https://github.com/orgs/LLM-Orchestration/projects/1",
    "issue_node_id": "I_123"
  }
}
EOF

# Create a dummy comment on stdin
echo "Handoff comment" > "$TEST_DIR/comment.md"

# Test 1: Fail because project item is not found
cat > "$TEST_DIR/gh" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  "issue view"*)
    echo '{"labels":[]}'
    ;;
  *"project item-list"*)
    # Return empty string to simulate item not found after jq filter
    echo ""
    ;;
  "project view"*)
    echo '"PVT_kwDOA123"'
    ;;
  *)
    exit 0
    ;;
esac
EOF
chmod +x "$TEST_DIR/gh"

echo "Running handoff.sh (expecting failure due to missing project item)..."
if bash scripts/handoff.sh coder < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: Could not find project item for issue node ID I_123 in project 1" "$TEST_DIR/stderr"; then
    echo "Success: handoff.sh failed with correct error message"
  else
    echo "Error: handoff.sh failed but with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

# Test 2: Fail because field 'Persona' is missing
cat > "$TEST_DIR/gh" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  "issue view"*)
    echo '{"labels":[]}'
    ;;
  *"project item-list"*)
    echo '{"id": "ITEM_123"}'
    ;;
  "project view"*)
    echo '"PVT_kwDOA123"'
    ;;
  *"project field-list"*)
    echo '{"fields": []}'
    ;;
  *)
    exit 0
    ;;
esac
EOF

echo "Running handoff.sh (expecting failure due to missing Persona field)..."
if bash scripts/handoff.sh coder < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: Could not find 'Persona' field in project 1" "$TEST_DIR/stderr"; then
    echo "Success: handoff.sh failed with correct error message"
  else
    echo "Error: handoff.sh failed but with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

# Test 3: Fail because verification fails
cat > "$TEST_DIR/gh" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  "issue view"*)
    echo '{"labels":[]}'
    ;;
  *"project item-list"*".fieldValues"*)
    # Verification readback: return wrong persona
    echo "conductor"
    ;;
  *"project item-list"*)
    echo '{"id": "ITEM_123"}'
    ;;
  "project view"*)
    echo '"PVT_kwDOA123"'
    ;;
  *"project field-list"*)
    echo '{"fields": [{"name": "Persona", "id": "FIELD_P", "options": [{"name": "coder", "id": "OPT_CODER"}]}]}'
    ;;
  *)
    exit 0
    ;;
esac
EOF

echo "Running handoff.sh (expecting failure due to verification timeout)..."
# We'll reduce the sleep/retries in handoff.sh if we could, but let's just wait or mock sleep
# Actually, I'll just wait, it's 5 * 2 seconds = 10 seconds.
if bash scripts/handoff.sh coder < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: Failed to verify Project V2 Persona update to 'coder' for item ITEM_123" "$TEST_DIR/stderr"; then
    echo "Success: handoff.sh failed with correct verification error"
  else
    echo "Error: handoff.sh failed but with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

echo "All handoff validation tests passed!"
exit 0
