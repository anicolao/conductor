#!/usr/bin/env bash
set -euo pipefail

# scripts/handle-validation-failure.sh PR_NUMBER [REPOSITORY]

PR_NUMBER="${1:-}"
REPOSITORY="${2:-$GITHUB_REPOSITORY}"

if [ -z "$PR_NUMBER" ]; then
  echo "Usage: $0 PR_NUMBER [REPOSITORY]" >&2
  exit 1
fi

echo "Handling validation failure for PR #$PR_NUMBER in $REPOSITORY"

# 1. Use gh api to get PR body and headRefName.
PR_DATA=$(gh api "repos/$REPOSITORY/pulls/$PR_NUMBER" --jq '{body: .body, headRefName: .head.ref}')
PR_BODY=$(echo "$PR_DATA" | jq -r '.body')
HEAD_REF=$(echo "$PR_DATA" | jq -r '.headRefName')

# 2. Extract parent issue number from the body (look for "Closes #...", "Fixes #...", "Resolves #...").
# Supported patterns: Closes #123, Fixes #123, Resolves #123, etc.
ISSUE_NUMBER=$(echo "$PR_BODY" | grep -oEi '(closes|fixes|resolves) #[0-9]+' | head -n 1 | grep -oE '[0-9]+' || true)

if [ -z "$ISSUE_NUMBER" ]; then
  echo "Could not find parent issue number in PR #$PR_NUMBER body."
  exit 0
fi

# 3. Identify if it's "system-created".
# Identification: Consider a PR "system-created" if its branch name matches issue-[0-9]+ OR if the parent issue has a persona: label.
IS_SYSTEM_CREATED=false
if [[ "$HEAD_REF" =~ ^issue-[0-9]+$ ]]; then
  IS_SYSTEM_CREATED=true
fi

ISSUE_DATA=$(gh api "repos/$REPOSITORY/issues/$ISSUE_NUMBER")
ISSUE_LABELS=$(echo "$ISSUE_DATA" | jq -r '.labels[].name')
ISSUE_NODE_ID=$(echo "$ISSUE_DATA" | jq -r '.node_id')

if echo "$ISSUE_LABELS" | grep -q "^persona:"; then
  IS_SYSTEM_CREATED=true
fi

if [ "$IS_SYSTEM_CREATED" = "false" ]; then
  echo "PR #$PR_NUMBER is not considered system-created. Skipping."
  exit 0
fi

echo "Parent issue: #$ISSUE_NUMBER"

# 4. Use targeted GraphQL to find the project item and current status of the parent issue.
# The project we are interested in is project number 1 ("Platform 10").
PROJECT_NUMBER=1
PROJECT_OWNER="LLM-Orchestration"

ITEM_DATA=$(gh api graphql -f id="$ISSUE_NODE_ID" -f query='
  query($id: ID!) {
    node(id: $id) {
      ... on Issue {
        projectItems(first: 20) {
          nodes {
            id
            project {
              id
              number
            }
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
              }
            }
          }
        }
      }
    }
  }' --jq ".data.node.projectItems.nodes[] | select(.project.number == $PROJECT_NUMBER) | {id: .id, project: {id: .project.id}, status: .status.name}" | head -n 1)

if [ -z "$ITEM_DATA" ]; then
  echo "Parent issue #$ISSUE_NUMBER is not in project $PROJECT_NUMBER. Skipping project status update."
else
  CURRENT_STATUS=$(echo "$ITEM_DATA" | jq -r '.status // empty')
  
  # 5. If the status is NOT "In Progress", move it back to "In Progress".
  if [ "$CURRENT_STATUS" != "In Progress" ]; then
    echo "Current status is '$CURRENT_STATUS'. Moving back to 'In Progress'."
    
    ITEM_ID=$(echo "$ITEM_DATA" | jq -r '.id')
    PROJECT_ID=$(echo "$ITEM_DATA" | jq -r '.project.id')
    
    # We need field ID for "Status" and option ID for "In Progress"
    FIELDS_JSON=$(gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json)
    STATUS_FIELD_ID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name == "Status") | .id')
    IN_PROGRESS_OPTION_ID=$(echo "$FIELDS_JSON" | jq -r ".fields[] | select(.name == \"Status\") | .options[] | select(.name == \"In Progress\") | .id")
    
    if [ -n "$STATUS_FIELD_ID" ] && [ -n "$IN_PROGRESS_OPTION_ID" ]; then
      gh project item-edit \
        --id "$ITEM_ID" \
        --project-id "$PROJECT_ID" \
        --field-id "$STATUS_FIELD_ID" \
        --single-select-option-id "$IN_PROGRESS_OPTION_ID" > /dev/null
      
      echo "Moved issue #$ISSUE_NUMBER back to In Progress."
    else
      echo "Could not find Status field or In Progress option ID. Status field: $STATUS_FIELD_ID, Option: $IN_PROGRESS_OPTION_ID"
    fi
  else
    echo "Issue #$ISSUE_NUMBER is already In Progress."
  fi
fi

# 6. Post a comment on the parent issue.
COMMENT_BODY="I am the **automation**

### ❌ Validation Failed on PR #$PR_NUMBER

The validation workflows failed on the associated PR. This issue has been moved back to **In Progress** for further work.

Please check the PR for details: [PR #$PR_NUMBER](https://github.com/$REPOSITORY/pull/$PR_NUMBER)"

gh issue comment "$ISSUE_NUMBER" -R "$REPOSITORY" --body "$COMMENT_BODY"
echo "Comment posted on issue #$ISSUE_NUMBER."
