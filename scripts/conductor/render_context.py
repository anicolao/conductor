#!/usr/bin/env python3

import argparse
import json
import os
from pathlib import Path


def fenced(text: str) -> str:
    body = (text or "").rstrip()
    return "```text\n" + body + "\n```" if body else "_Empty_"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issue-json", required=True)
    parser.add_argument("--comments-json", required=True)
    parser.add_argument("--event-json", required=True)
    parser.add_argument("--context-path", required=True)
    args = parser.parse_args()

    issue = json.loads(Path(args.issue_json).read_text())
    comments = json.loads(Path(args.comments_json).read_text())
    event = json.loads(Path(args.event_json).read_text())

    repo = os.environ.get("CONDUCTOR_REPO", os.environ.get("GITHUB_REPOSITORY", "unknown"))
    persona = os.environ.get("CONDUCTOR_PERSONA", "unknown")
    trigger_kind = os.environ.get("CONDUCTOR_TRIGGER_KIND", "unknown")
    default_branch = os.environ.get("CONDUCTOR_DEFAULT_BRANCH", "main")

    labels = [label["name"] for label in issue.get("labels", [])]
    issue_author = (issue.get("user") or {}).get("login", "unknown")

    trigger_header = "Issue body"
    trigger_body = issue.get("body") or ""
    if event.get("comment"):
        trigger_header = "Triggering comment"
        trigger_body = event["comment"].get("body") or ""

    lines = [
        "# Conductor Run Context",
        "",
        "## Metadata",
        f"- Repository: `{repo}`",
        f"- Issue: `#{issue['number']}`",
        f"- URL: {issue.get('html_url', '')}",
        f"- Title: {issue.get('title', '')}",
        f"- Issue author: `@{issue_author}`",
        f"- Active persona: `@{persona}`",
        f"- Trigger kind: `{trigger_kind}`",
        f"- Default branch: `{default_branch}`",
        f"- Current labels: `{', '.join(labels) if labels else 'none'}`",
        "",
        "## Routing Contract",
        "- Labels determine the active persona.",
        "- Comments trigger the next run.",
        "- Leave the issue ready for the next actor before exiting.",
        "",
        "## Issue Body",
        fenced(issue.get("body") or ""),
        "",
        f"## {trigger_header}",
        fenced(trigger_body),
        "",
        "## Comment History",
    ]

    if not comments:
        lines.extend(["_No comments yet._", ""])
    else:
        for comment in comments:
            author = (comment.get("user") or {}).get("login", "unknown")
            created_at = comment.get("created_at", "unknown")
            lines.extend(
                [
                    f"### Comment by @{author} at {created_at}",
                    fenced(comment.get("body") or ""),
                    "",
                ]
            )

    Path(args.context_path).write_text("\n".join(lines).rstrip() + "\n")


if __name__ == "__main__":
    main()
