#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


KNOWN_PERSONAS = {"conductor", "coder"}
MENTION_PATTERN = re.compile(r"(?<![\w-])@conductor\b", re.IGNORECASE)
OUTPUT_DELIMITER = "CONDUCTOR_EOF"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def issue_from_event(event: dict[str, Any]) -> dict[str, Any]:
    issue = event.get("issue")
    if not isinstance(issue, dict):
        raise ValueError("GitHub event payload does not contain an issue.")
    return issue


def is_pull_request_issue(issue: dict[str, Any]) -> bool:
    return "pull_request" in issue


def labels_from_issue(issue: dict[str, Any]) -> list[str]:
    names: list[str] = []
    for label in issue.get("labels", []):
        if isinstance(label, dict) and isinstance(label.get("name"), str):
            names.append(label["name"])
    return names


def persona_from_labels(labels: list[str]) -> str | None:
    for label in labels:
        lowered = label.strip().lower()
        if not lowered.startswith("persona:"):
            continue
        _, _, persona_name = lowered.partition(":")
        persona = persona_name.strip()
        if persona in KNOWN_PERSONAS:
            return persona
    return None


def should_start_from_mention(event: dict[str, Any], issue: dict[str, Any]) -> bool:
    texts = [issue.get("body", "")]
    comment = event.get("comment")
    if isinstance(comment, dict):
        texts.append(comment.get("body", ""))
    return any(isinstance(text, str) and MENTION_PATTERN.search(text) for text in texts)


def determine_persona(event: dict[str, Any]) -> str | None:
    issue = issue_from_event(event)
    persona = persona_from_labels(labels_from_issue(issue))
    if persona:
        return persona
    if should_start_from_mention(event, issue):
        return "conductor"
    return None


def markdown_documents(repo_root: Path) -> list[tuple[str, str]]:
    documents: list[tuple[str, str]] = []
    for path in sorted(repo_root.rglob("*.md")):
        if ".git" in path.parts:
            continue
        relative = path.relative_to(repo_root).as_posix()
        documents.append((relative, path.read_text(encoding="utf-8")))
    return documents


def render_comments(comments: list[dict[str, Any]]) -> str:
    if not comments:
        return "No previous issue comments were found."

    rendered: list[str] = []
    for comment in comments:
        user = comment.get("user") or {}
        login = user.get("login", "unknown")
        created_at = comment.get("created_at", "unknown time")
        body = comment.get("body", "")
        rendered.append(f"- {login} at {created_at}:\n{body}".rstrip())
    return "\n\n".join(rendered)


def build_prompt(
    repo_root: Path,
    persona: str,
    event: dict[str, Any],
    comments: list[dict[str, Any]],
) -> str:
    issue = issue_from_event(event)
    prompt_path = repo_root / ".github" / "prompts" / f"{persona}.md"
    persona_prompt = prompt_path.read_text(encoding="utf-8").strip()
    issue_number = issue.get("number", "")
    issue_title = issue.get("title", "")
    issue_body = issue.get("body", "")
    labels = ", ".join(labels_from_issue(issue)) or "(none)"
    comment = event.get("comment")

    sections = [
        persona_prompt,
        "Repository markdown documents:",
    ]

    for relative, content in markdown_documents(repo_root):
        sections.append(f"--- BEGIN {relative} ---\n{content.rstrip()}\n--- END {relative} ---")

    sections.extend(
        [
            "GitHub issue context:",
            f"Repository: {event.get('repository', {}).get('full_name', '')}",
            f"Issue number: {issue_number}",
            f"Issue title: {issue_title}",
            f"Issue labels: {labels}",
            f"Issue body:\n{issue_body}".rstrip(),
            "Issue comment history:",
            render_comments(comments),
        ]
    )

    if isinstance(comment, dict):
        sections.extend(
            [
                "Current triggering comment:",
                f"Author: {comment.get('user', {}).get('login', 'unknown')}",
                f"Created at: {comment.get('created_at', 'unknown time')}",
                f"Body:\n{comment.get('body', '')}".rstrip(),
            ]
        )

    sections.append(
        "Act now using the active persona instructions above. Use the repository contents, git, and gh as needed."
    )
    return "\n\n".join(section for section in sections if section.strip())


def write_outputs(path: Path, outputs: dict[str, str]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        for key, value in outputs.items():
            handle.write(f"{key}<<{OUTPUT_DELIMITER}\n{value}\n{OUTPUT_DELIMITER}\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Resolve the Conductor persona and prompt.")
    parser.add_argument("--event-path", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--repo-root", type=Path)
    parser.add_argument("--persona")
    parser.add_argument("--comments-path", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    event = load_json(args.event_path)
    issue = issue_from_event(event)

    if is_pull_request_issue(issue):
        write_outputs(args.output, {"should_run": "false", "reason": "pull_request_issue"})
        return 0

    persona = determine_persona(event)
    outputs: dict[str, str] = {
        "should_run": "true" if persona else "false",
        "issue_number": str(issue.get("number", "")),
        "persona": persona or "",
    }

    if args.repo_root and args.persona:
        comments: list[dict[str, Any]] = []
        if args.comments_path and args.comments_path.exists():
            loaded_comments = load_json(args.comments_path)
            if isinstance(loaded_comments, list):
                comments = [item for item in loaded_comments if isinstance(item, dict)]
        outputs["prompt"] = build_prompt(args.repo_root, args.persona, event, comments)

    write_outputs(args.output, outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
