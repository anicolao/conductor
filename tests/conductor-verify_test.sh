#!/usr/bin/env bash
set -euo pipefail

# This script tests conductor-verify.sh by mocking the 'git' command.

# Create a temporary directory for our test environment
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

# Set up environment for tests
export PATH="$TEST_DIR:$PATH"
MOCK_UNCOMMITTED_FILE="$TEST_DIR/mock_uncommitted"
MOCK_COMMITTED_FILE="$TEST_DIR/mock_committed"
MOCK_CURRENT_BRANCH="feature-branch"

# Create a dummy git mock
cat > "$TEST_DIR/git" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "status --porcelain -- src functions tests")
    if [ -f "$MOCK_UNCOMMITTED_FILE" ]; then
      cat "$MOCK_UNCOMMITTED_FILE"
    fi
    ;;
  "branch --show-current")
    echo "$MOCK_CURRENT_BRANCH"
    ;;
  "rev-parse --verify main")
    exit 0
    ;;
  "diff --name-only main...feature-branch -- src functions tests")
    if [ -f "$MOCK_COMMITTED_FILE" ]; then
      cat "$MOCK_COMMITTED_FILE"
    fi
    ;;
  *)
    # For any other git command, just exit 0 to avoid errors in the script
    exit 0
    ;;
esac
EOF
chmod +x "$TEST_DIR/git"

# Test 1: Success when no changes detected
echo "Running Test 1: No unauthorized changes (expecting success)..."
rm -f "$MOCK_UNCOMMITTED_FILE" "$MOCK_COMMITTED_FILE"
if bash scripts/conductor-verify.sh; then
  echo "Success: Test 1 passed"
else
  echo "Error: Test 1 failed"
  exit 1
fi

# Test 2: Failure with uncommitted changes
echo "Running Test 2: Uncommitted changes detected (expecting failure)..."
echo "M src/index.ts" > "$MOCK_UNCOMMITTED_FILE"
if bash scripts/conductor-verify.sh 2> "$TEST_DIR/stderr"; then
  echo "Error: Test 2 should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: Unauthorized uncommitted changes detected in forbidden directories:" "$TEST_DIR/stderr"; then
    echo "Success: Test 2 failed with correct error message"
  else
    echo "Error: Test 2 failed but with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

# Test 3: Failure with committed changes
echo "Running Test 3: Committed changes detected (expecting failure)..."
rm -f "$MOCK_UNCOMMITTED_FILE"
echo "src/utils/helper.ts" > "$MOCK_COMMITTED_FILE"
if bash scripts/conductor-verify.sh 2> "$TEST_DIR/stderr"; then
  echo "Error: Test 3 should have failed but exited with 0"
  exit 1
else
  if grep -q "Error: Unauthorized committed changes detected in forbidden directories (vs main):" "$TEST_DIR/stderr"; then
    echo "Success: Test 3 failed with correct error message"
  else
    echo "Error: Test 3 failed but with wrong message"
    cat "$TEST_DIR/stderr"
    exit 1
  fi
fi

echo "All conductor-verify tests passed!"
exit 0
