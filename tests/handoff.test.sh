#!/usr/bin/env bash
set -euo pipefail

# Mock directory for gh and git
MOCK_DIR="$(mktemp -d)"
trap 'rm -rf "$MOCK_DIR"' EXIT

export PATH="$MOCK_DIR:$PATH"
export GITHUB_REPOSITORY="owner/repo"
export GITHUB_EVENT_PATH="$MOCK_DIR/event.json"

# Create a dummy event.json
cat > "$GITHUB_EVENT_PATH" <<EOF
{
  "client_payload": {
    "issue_number": 123,
    "repository": "owner/repo",
    "item_id": "item_123",
    "project_number": 1
  }
}
EOF

# Create a dummy git mock
cat > "$MOCK_DIR/git" <<'EOF'
#!/usr/bin/env bash
if [[ "$*" == "branch --show-current" ]]; then
  echo "recover-cross-repo-orchestration"
  exit 0
fi
if [[ "$*" == "rev-parse --abbrev-ref HEAD" ]]; then
  echo "recover-cross-repo-orchestration"
  exit 0
fi
# Fallback to real git for other commands if needed, 
# but for tests we should avoid depending on the real repo state.
exit 0
EOF
chmod +x "$MOCK_DIR/git"

# Create the mock gh command
cat > "$MOCK_DIR/gh" <<'EOF'
#!/usr/bin/env bash
args=("$@")
cmd_log="$MOCK_LOG"

echo "gh ${args[*]}" >> "$cmd_log"

case "${args[0]}" in
  "issue")
    case "${args[1]}" in
      "view")
        # Script uses: gh issue view "$issue_number" -R "$repository" --json labels --jq '.labels[].name'
        echo "persona: current"
        ;;
      "comment")
        echo "https://github.com/owner/repo/issues/123#issuecomment-999"
        ;;
      "edit")
        echo "Issue edited"
        ;;
    esac
    ;;
  "api")
    if [[ "${args[1]}" == "repos/owner/repo/issues/comments/999" ]]; then
       # Verify readback works by default
       echo '{"id": 999}'
    else
       # default api mock
       echo '{}'
    fi
    ;;
  "label")
    # Script uses: gh label list -R "$repository" --json name --jq '.[].name'
    echo "branch: main"
    ;;
  "project")
    echo "Project updated"
    ;;
esac
EOF
chmod +x "$MOCK_DIR/gh"

export MOCK_LOG="$MOCK_DIR/commands.log"
touch "$MOCK_LOG"

echo "Running Test 1: Successful handoff"
echo "test comment" | bash scripts/handoff.sh conductor > /dev/null

# Check order
# 1. gh issue comment
# 2. gh api ... (verify)
# 3. gh issue edit (labels)
# 4. gh project item-edit (persona)

expected_order=(
  "gh issue comment 123 -R owner/repo --body-file"
  "gh api repos/owner/repo/issues/comments/999"
  "gh issue edit 123 -R owner/repo --remove-label persona: current --add-label persona: conductor"
  "gh project item-edit --id item_123 --field Persona --value conductor"
)

# Verify order in log
i=0
while IFS= read -r line; do
  if [[ "$line" == *"${expected_order[$i]}"* ]]; then
    echo "Matched step $((i+1)): $line"
    i=$((i+1))
    if [ $i -eq ${#expected_order[@]} ]; then break; fi
  fi
done < "$MOCK_LOG"

if [ $i -ne ${#expected_order[@]} ]; then
  echo "Error: Expected steps not found or out of order"
  cat "$MOCK_LOG"
  exit 1
fi

echo "Test 1 Passed"

# Test 2: Readback failure
echo "Running Test 2: Readback failure"
rm "$MOCK_LOG" && touch "$MOCK_LOG"

# Update mock gh to fail api readback for comment 888
cat > "$MOCK_DIR/gh" <<'EOF'
#!/usr/bin/env bash
args=("$@")
echo "gh ${args[*]}" >> "$MOCK_LOG"
case "${args[0]}" in
  "issue")
    case "${args[1]}" in
      "view") echo "" ;;
      "comment") echo "https://github.com/owner/repo/issues/123#issuecomment-888" ;;
    esac
    ;;
  "api")
    if [[ "${args[1]}" == "repos/owner/repo/issues/comments/888" ]]; then
       exit 1 # Simulate failure
    fi
    ;;
  "label") echo "[]" ;;
esac
EOF
chmod +x "$MOCK_DIR/gh"

if echo "fail comment" | bash scripts/handoff.sh conductor 2>/dev/null; then
  echo "Error: handoff.sh should have failed due to readback failure"
  exit 1
else
  echo "Test 2 Passed (failed as expected)"
fi

echo "All tests passed!"
