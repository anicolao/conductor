#!/usr/bin/env bash
set -euo pipefail

# This script tests handoff.sh failure modes by mocking the 'gh' and 'git' commands.

# Create a temporary directory for our test environment
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

# Set up environment for handoff.sh
export PATH="$TEST_DIR:$PATH"
export GITHUB_EVENT_PATH="$TEST_DIR/event.json"
export GITHUB_REPOSITORY="LLM-Orchestration/conductor"

# Mock sleep to speed up tests
cat > "$TEST_DIR/sleep" <<EOF
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TEST_DIR/sleep"

# Create a dummy git mock
cat > "$TEST_DIR/git" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "branch --show-current")
    echo "test-branch"
    exit 0
    ;;
  "status --porcelain"*)
    if [ -f "$TEST_DIR/mock_uncommitted" ]; then
      cat "$TEST_DIR/mock_uncommitted"
    fi
    exit 0
    ;;
  "rev-parse --verify main")
    exit 0
    ;;
  "rev-list --count main..HEAD")
    cat "$TEST_DIR/mock_commit_count" 2>/dev/null || echo "0"
    exit 0
    ;;
  "checkout issue-123")
    exit 1
    ;;
  "checkout -b issue-123")
    exit 0
    ;;
  *)
    # For any other command, just return 0 to avoid errors
    exit 0
    ;;
esac
EOF
chmod +x "$TEST_DIR/git"

branch_name="test-branch"

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
    echo "persona: coder"
    echo "branch: test-branch"
    echo '{"labels":[{"name":"persona: coder"}, {"name":"branch: test-branch"}]}'
    ;;
  *"project item-list"*)
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

echo "Running Test 1: Fail because project item is not found..."
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: Could not find project item for issue node ID I_123 in project 1 (owner: LLM-Orchestration)" "$TEST_DIR/stderr"; then
    echo "Success: Test 1 passed"
  else
    echo "Error: Test 1 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

# Test 2: Fail because field 'Persona' is missing
cat > "$TEST_DIR/gh" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  "issue view"*)
    echo "persona: coder"
    echo "branch: test-branch"
    echo '{"labels":[{"name":"persona: coder"}, {"name":"branch: test-branch"}]}'
    ;;
  *"project item-list"*)
    echo '{"id": "ITEM_123", "content": {"id": "I_123"}}'
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

echo "Running Test 2: Fail because field 'Persona' is missing..."
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: Could not find 'Persona' field in project 1" "$TEST_DIR/stderr"; then
    echo "Success: Test 2 passed"
  else
    echo "Error: Test 2 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

# Test 3: Fail because verification fails
cat > "$TEST_DIR/gh" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  "issue view"*)
    echo "persona: coder"
    echo "branch: test-branch"
    echo '{"labels":[{"name":"persona: coder"}, {"name":"branch: test-branch"}]}'
    ;;
  *"project item-list"*)
    if [[ "$*" == *".persona"* ]]; then
      echo "conductor"
    else
      echo '{"id": "ITEM_123", "persona": "conductor"}'
    fi
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

echo "Running Test 3: Fail because verification fails..."
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: Failed to verify Project V2 Persona update to 'coder' for item ITEM_123" "$TEST_DIR/stderr"; then
    echo "Success: Test 3 passed"
  else
    echo "Error: Test 3 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

# Test 4: Success with user project
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 123,
    "project_number": 2,
    "project_url": "https://github.com/users/someuser/projects/2",
    "issue_node_id": "I_123"
  }
}
EOF
cat > "$TEST_DIR/gh" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "issue view"*".labels[].name"*)
    echo "persona: tester"
    echo "branch: $branch_name"
    ;;
  "issue view"*)
    echo '{"labels":[{"name":"persona: tester"}, {"name":"branch: $branch_name"}]}'
    ;;
  *"project item-list"*)
    if [[ "\$*" == *"--owner someuser"* ]]; then
      if [[ "\$*" == *".persona"* ]]; then
        echo "tester"
      else
        echo '{"id": "ITEM_USER_123", "persona": "tester", "content": {"number": 123, "repository": "LLM-Orchestration/conductor"}}'
      fi
    else
      echo "Error: wrong owner" >&2
      exit 1
    fi
    ;;
  "project view"*)
    echo '"PVT_USER_123"'
    ;;
  *"project field-list"*)
    echo '{"fields": [{"name": "Persona", "id": "FIELD_P", "options": [{"name": "tester", "id": "OPT_TESTER"}]}]}'
    ;;
  *)
    exit 0
    ;;
esac
EOF

chmod +x "$TEST_DIR/gh"

echo "Running Test 4: Success with user project..."
if bash scripts/handoff.sh tester 0 < "$TEST_DIR/comment.md"; then
  echo "Success: Test 4 passed"
else
  echo "Error: Test 4 failed"
  exit 1
fi

# Test 5: Basic label handoff (no project info)
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 456,
    "repository": "LLM-Orchestration/other-repo"
  }
}
EOF
cat > "$TEST_DIR/gh" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "issue view"*".labels[].name"*)
    echo "persona: conductor"
    echo "branch: $branch_name"
    ;;
  "issue view"*)
    echo '{"labels":[{"name":"persona: conductor"}, {"name":"branch: $branch_name"}]}'
    ;;
  "issue edit"*)
    if [[ "\$*" == *"-R LLM-Orchestration/other-repo"* ]] && [[ "\$*" == *"--add-label persona: conductor"* ]]; then
      exit 0
    else
      echo "Error: wrong repo or label in issue edit" >&2
      exit 1
    fi
    ;;
  "issue comment"*)
    if [[ "\$*" == *"-R LLM-Orchestration/other-repo"* ]]; then
      exit 0
    else
      echo "Error: wrong repo in issue comment" >&2
      exit 1
    fi
    ;;
  *)
    exit 0
    ;;
esac
EOF

echo "Running Test 5: Basic label handoff (no project info)..."
if bash scripts/handoff.sh conductor 0 < "$TEST_DIR/comment.md"; then
  echo "Success: Test 5 passed"
else
  echo "Error: Test 5 failed"
  exit 1
fi

# Test 6: Auto-branch away from main before labeling
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 123,
    "repository": "LLM-Orchestration/conductor"
  }
}
EOF
cat > "$TEST_DIR/git" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  "branch --show-current")
    echo "main"
    exit 0
    ;;
  "checkout issue-123")
    exit 1
    ;;
  "checkout -b issue-123")
    exit 0
    ;;
  "status --porcelain")
    exit 0
    ;;
  "rev-parse --verify main")
    exit 0
    ;;
  "rev-list --count main..HEAD")
    echo "0"
    exit 0
    ;;
  *)
    exec git "$@"
    ;;
esac
EOF
chmod +x "$TEST_DIR/git"

cat > "$TEST_DIR/gh" <<'EOF'
#!/usr/bin/env bash
MARKER_FILE="${GITHUB_EVENT_PATH}.main_branch_labels_set"
case "$*" in
  "issue view"*".labels[].name"*)
    if [ -f "$MARKER_FILE" ]; then
      echo "persona: coder"
      echo "branch: issue-123"
    else
      echo "persona: coder"
    fi
    ;;
  "issue view"*)
    if [ -f "$MARKER_FILE" ]; then
      echo '{"labels":[{"name":"persona: coder"},{"name":"branch: issue-123"}]}'
    else
      echo '{"labels":[{"name":"persona: coder"}]}'
    fi
    ;;
  "issue edit"*)
    if [[ "$*" == *"--add-label persona: coder"* ]] && [[ "$*" == *"--add-label branch: issue-123"* ]] && [[ "$*" != *"--add-label branch: main"* ]]; then
      touch "$MARKER_FILE"
      exit 0
    else
      echo "Error: wrong labels in issue edit for main fallback" >&2
      exit 1
    fi
    ;;
  "issue comment"*)
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
EOF
chmod +x "$TEST_DIR/gh"
rm -f "${GITHUB_EVENT_PATH}.main_branch_labels_set"

echo "Running Test 6: Auto-branch away from main..."
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md"; then
  echo "Success: Test 6 passed"
else
  echo "Error: Test 6 failed"
  exit 1
fi

# Reset git mock for further tests
cat > "$TEST_DIR/git" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "branch --show-current")
    echo "test-branch"
    exit 0
    ;;
  "status --porcelain"*)
    if [ -f "$TEST_DIR/mock_uncommitted" ]; then
      cat "$TEST_DIR/mock_uncommitted"
    fi
    exit 0
    ;;
  "rev-parse --verify main")
    exit 0
    ;;
  "rev-list --count main..HEAD")
    cat "$TEST_DIR/mock_commit_count" 2>/dev/null || echo "0"
    exit 0
    ;;
  *)
    # For any other command, just return 0 to avoid errors
    exit 0
    ;;
esac
EOF
chmod +x "$TEST_DIR/git"

# Test 7: Success with fallback when issue_node_id is missing
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 123,
    "project_number": 1,
    "project_url": "https://github.com/orgs/LLM-Orchestration/projects/1"
  }
}
EOF
cat > "$TEST_DIR/gh" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "issue view"*".labels[].name"*)
    echo "persona: coder"
    echo "branch: $branch_name"
    ;;
  "issue view"*)
    echo '{"labels":[{"name":"persona: coder"}, {"name":"branch: $branch_name"}]}'
    ;;
  *"project item-list"*)
    if [[ "\$*" == *".persona"* ]]; then
      echo "coder"
    else
      echo '{"id": "ITEM_123", "persona": "coder", "content": {"number": 123, "repository": "LLM-Orchestration/conductor"}}'
    fi
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
chmod +x "$TEST_DIR/gh"

echo "Running Test 7: Success with fallback when issue_node_id is missing..."
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  if grep -q "Warning: issue_node_id is missing, will attempt to find project item by issue number and repository" "$TEST_DIR/stderr"; then
    echo "Success: Test 7 passed"
  else
    echo "Error: Test 7 missing expected warning"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
else
  echo "Error: Test 7 failed"
  cat "$TEST_DIR/stderr"
  exit 1
fi

# Test 8: Fail because project_number provided but project_url is missing
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 123,
    "project_number": 1,
    "issue_node_id": "I_123"
  }
}
EOF

echo "Running Test 8: Fail because project_number provided but project_url is missing..."
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: project_number provided but project_owner could not be determined from project_url" "$TEST_DIR/stderr"; then
    echo "Success: Test 8 passed"
  else
    echo "Error: Test 8 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

# Test 9: Success for 'human' target (removes persona labels, preserves branch)
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 789,
    "repository": "LLM-Orchestration/conductor",
    "project_number": 1,
    "project_url": "https://github.com/orgs/LLM-Orchestration/projects/1"
  }
}
EOF
cat > "$TEST_DIR/gh" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "issue view"*".labels[].name"*)
    if [ -f "$TEST_DIR/labels_removed" ]; then
      echo "branch: $branch_name"
    else
      echo "persona: conductor"
      echo "branch: $branch_name"
    fi
    ;;
  "issue edit"*)
    if [[ "\$*" == *"--remove-label persona: conductor"* ]] && [[ "\$*" == *"--add-label branch: $branch_name"* ]] && [[ "\$*" != *"--add-label persona:"* ]]; then
      touch "$TEST_DIR/labels_removed"
      exit 0
    else
      echo "Error: wrong labels in issue edit for human target" >&2
      exit 1
    fi
    ;;
  "project"*)
    echo "Error: Project commands should not be called for human target" >&2
    exit 1
    ;;
  *)
    exit 0
    ;;
esac
EOF
chmod +x "$TEST_DIR/gh"
rm -f "$TEST_DIR/labels_removed"

echo "Running Test 9: Success for 'human' target..."
if bash scripts/handoff.sh human < "$TEST_DIR/comment.md"; then
  echo "Success: Test 9 passed"
else
  echo "Error: Test 9 failed"
  exit 1
fi

# Test 10: conductor-verify.sh is RUN when handing off to human
mkdir -p "$TEST_DIR/scripts"
cat > "$TEST_DIR/scripts/conductor-verify.sh" <<EOF
#!/usr/bin/env bash
echo "Conductor verification failed!" >&2
exit 1
EOF
chmod +x "$TEST_DIR/scripts/conductor-verify.sh"

cp scripts/handoff.sh "$TEST_DIR/handoff.sh"
# Also need to copy or mock the node command if it's used
# But node is available in the environment

echo "Running Test 10: conductor-verify.sh is RUN when handing off to human..."
if ! (
  cd "$TEST_DIR"
  cat > "$TEST_DIR/gh" <<EOF2
#!/usr/bin/env bash
case "\$*" in
  "issue view"*".labels[].name"*)
    echo "persona: conductor"
    echo "branch: test-branch"
    ;;
  *)
    exit 0
    ;;
esac
EOF2
  chmod +x "$TEST_DIR/gh"
  export CONDUCTOR_ROOT="$TEST_DIR"
  bash handoff.sh human < comment.md
) 2> "$TEST_DIR/stderr"; then
  if grep -q "Conductor verification failed!" "$TEST_DIR/stderr"; then
    echo "Success: Test 10 passed"
  else
    echo "Error: Test 10 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
else
  echo "Error: Test 10 should have failed"
  exit 1
fi

# Test 11: Header prepending
export CONDUCTOR_PERSONA="coder"
export CONDUCTOR_LAST_COMMENT_URL="https://github.com/LLM-Orchestration/conductor/issues/123#issuecomment-456789"
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 123
  }
}
EOF
cat > "$TEST_DIR/gh" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "issue view"*".labels[].name"*)
    echo "persona: conductor"
    echo "branch: test-branch"
    ;;
  "issue view"*)
    echo '{"labels":[{"name":"persona: conductor"}, {"name":"branch: test-branch"}]}'
    ;;
  "issue comment"*)
    while [ "\$#" -gt 0 ]; do
      if [ "\$1" == "--body-file" ]; then
        cp "\$2" "$TEST_DIR/captured_body.md"
        break
      fi
      shift
    done
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
EOF
chmod +x "$TEST_DIR/gh"

echo "Running Test 11: Header prepending..."
echo "Original body" | bash scripts/handoff.sh conductor 0

if grep -Fq "I am the **coder**, and I am responding to comment [456789](https://github.com/LLM-Orchestration/conductor/issues/123#issuecomment-456789) on branch test-branch." "$TEST_DIR/captured_body.md"; then
  echo "Success: Test 11 passed"
else
  echo "Error: Test 11 failed"
  cat "$TEST_DIR/captured_body.md"
  exit 1
fi

# NEW TESTS

# Test 12: NUMBER OF COMMITS MISMATCH FAILURE
echo "Running Test 12: NUMBER OF COMMITS MISMATCH FAILURE..."
echo "2" > "$TEST_DIR/mock_commit_count"
if bash scripts/handoff.sh coder 1 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed due to commit mismatch"
  exit 1
else
  if grep -q "NUMBER OF COMMITS MISMATCH FAILURE: Expected 1 commits but found 2" "$TEST_DIR/stderr"; then
    echo "Success: Test 12 passed"
  else
    echo "Error: Test 12 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi
rm -f "$TEST_DIR/mock_commit_count"

# Test 13: OPEN FILES STILL IN VM
echo "Running Test 13: OPEN FILES STILL IN VM..."
echo "M modified_file.ts" > "$TEST_DIR/mock_uncommitted"
if bash scripts/handoff.sh coder 0 < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed due to uncommitted changes"
  exit 1
else
  if grep -q "OPEN FILES STILL IN VM: You have uncommitted changes" "$TEST_DIR/stderr"; then
    echo "Success: Test 13 passed"
  else
    echo "Error: Test 13 failed with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi
rm -f "$TEST_DIR/mock_uncommitted"

echo "All handoff validation tests passed!"
exit 0
