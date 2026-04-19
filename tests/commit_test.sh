#!/usr/bin/env bash
set -euo pipefail

# This script tests scripts/commit.sh by mocking the 'git' command.

# Create a temporary directory for our test environment
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

# Set up environment for tests
export PATH="$TEST_DIR:$PATH"
GIT_CALLS_FILE="$TEST_DIR/git_calls"

# Create a dummy git mock
cat > "$TEST_DIR/git" <<EOF
#!/usr/bin/env bash
echo "git \$*" >> "$GIT_CALLS_FILE"
EOF
chmod +x "$TEST_DIR/git"

# Test 1: Successful commit with single word message
echo "Running Test 1: Single word message..."
rm -f "$GIT_CALLS_FILE"
bash scripts/commit.sh 155 "Initial"
if grep -Fq "git commit -m [#155] Initial" "$GIT_CALLS_FILE"; then
  echo "Success: Test 1 passed"
else
  echo "Error: Test 1 failed. Git calls:"
  cat "$GIT_CALLS_FILE"
  exit 1
fi

# Test 2: Successful commit with multiple words message
echo "Running Test 2: Multiple words message..."
rm -f "$GIT_CALLS_FILE"
bash scripts/commit.sh 155 "My commit message"
if grep -Fq "git commit -m [#155] My commit message" "$GIT_CALLS_FILE"; then
  echo "Success: Test 2 passed"
else
  echo "Error: Test 2 failed. Git calls:"
  cat "$GIT_CALLS_FILE"
  exit 1
fi

# Test 3: Missing arguments
echo "Running Test 3: Missing arguments..."
if bash scripts/commit.sh 155 2> /dev/null; then
  echo "Error: Test 3 should have failed due to missing arguments"
  exit 1
else
  echo "Success: Test 3 passed (failed as expected)"
fi

echo "All commit tests passed!"
exit 0
