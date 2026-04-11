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
# Create a dummy git mock
cat > "$TEST_DIR/git" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "branch --show-current")
    echo "test-branch"
    exit 0
    ;;
  "status --porcelain -- src functions tests")
    exit 0
    ;;
  "rev-parse --verify main")
    exit 0
    ;;
  "diff --name-only main...test-branch -- src functions tests")
    exit 0
    ;;
  *)
    exec git "\$@"
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
    # Return empty string to simulate item not found after jq filter
    # Note: handoff.sh uses --jq, so gh CLI would return nothing if select() matches nothing.
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
  if grep -q "Error: Could not find project item for issue node ID I_123 in project 1 (owner: LLM-Orchestration)" "$TEST_DIR/stderr"; then
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
    echo "persona: coder"
    echo "branch: test-branch"
    echo '{"labels":[{"name":"persona: coder"}, {"name":"branch: test-branch"}]}'
    ;;
  *"project item-list"*)
    # Verification readback or item finding
    # Note: handoff.sh uses --jq, so we return the unwrapped persona name or item object
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

echo "Running handoff.sh (expecting success with user project)..."
if bash scripts/handoff.sh tester < "$TEST_DIR/comment.md"; then
  echo "Success: handoff.sh succeeded with user project"
else
  echo "Error: handoff.sh failed with user project"
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

echo "Running handoff.sh (expecting success for basic label handoff)..."
if bash scripts/handoff.sh conductor < "$TEST_DIR/comment.md"; then
  echo "Success: handoff.sh succeeded with basic label handoff"
else
  echo "Error: handoff.sh failed with basic label handoff"
  exit 1
fi

# Test 6: Success with fallback when issue_node_id is missing
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
    # Return success by finding item via issue number and repository
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

echo "Running handoff.sh (expecting success with fallback for missing issue_node_id)..."
if bash scripts/handoff.sh coder < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  if grep -q "Warning: issue_node_id is missing, will attempt to find project item by issue number and repository" "$TEST_DIR/stderr"; then
    echo "Success: handoff.sh succeeded with fallback warning"
  else
    echo "Error: handoff.sh succeeded but missing expected warning"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
else
  echo "Error: handoff.sh should have succeeded with fallback"
  cat "$TEST_DIR/stderr"
  exit 1
fi

# Test 7: Fail because project_number provided but project_url is missing
cat > "$GITHUB_EVENT_PATH" <<'EOF'
{
  "client_payload": {
    "issue_number": 123,
    "project_number": 1,
    "issue_node_id": "I_123"
  }
}
EOF

echo "Running handoff.sh (expecting failure due to missing project_owner)..."
if bash scripts/handoff.sh coder < "$TEST_DIR/comment.md" 2> "$TEST_DIR/stderr"; then
  echo "Error: handoff.sh should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: project_number provided but project_owner could not be determined from project_url" "$TEST_DIR/stderr"; then
    echo "Success: handoff.sh failed with correct error message"
  else
    echo "Error: handoff.sh failed but with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

# Test 8: Success for 'human' target (removes persona labels, preserves branch)
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
      echo "Args: \$*" >&2
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

echo "Running handoff.sh human (expecting success, persona label removed, branch preserved, no project updates)..."
if bash scripts/handoff.sh human < "$TEST_DIR/comment.md"; then
  echo "Success: handoff.sh human succeeded correctly"
else
  echo "Error: handoff.sh human failed"
  exit 1
fi

# Test 9: conductor-verify.sh is RUN when handing off to human and can block it
# We mock conductor-verify.sh to fail
mkdir -p "$TEST_DIR/scripts"
cat > "$TEST_DIR/scripts/conductor-verify.sh" <<EOF
#!/usr/bin/env bash
echo "Conductor verification failed!" >&2
exit 1
EOF
chmod +x "$TEST_DIR/scripts/conductor-verify.sh"

cp scripts/handoff.sh "$TEST_DIR/handoff.sh"

echo "Running handoff.sh human with failing conductor-verify.sh (expecting failure as it should NOT be skipped)..."
if ! (
  cd "$TEST_DIR"
  # Mock gh again for this specific test
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
  
  bash handoff.sh human < comment.md
); then
  echo "Success: conductor-verify.sh was NOT skipped for human target and correctly blocked handoff"
else
  echo "Error: handoff.sh succeeded for human target even with failing conductor-verify.sh"
  exit 1
fi

echo "All handoff validation tests passed!"
exit 0
