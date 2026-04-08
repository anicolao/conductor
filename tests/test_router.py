import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.conductor import router


class RouterTests(unittest.TestCase):
    def test_persona_from_label_wins(self) -> None:
        event = {
            "issue": {
                "number": 1,
                "body": "No mentions here",
                "labels": [{"name": "persona: coder"}],
            }
        }

        self.assertEqual(router.determine_persona(event), "coder")

    def test_conductor_mention_starts_when_no_label_exists(self) -> None:
        event = {
            "issue": {"number": 1, "body": "@conductor please help", "labels": []},
        }

        self.assertEqual(router.determine_persona(event), "conductor")

    def test_no_label_or_mention_skips(self) -> None:
        event = {
            "issue": {"number": 1, "body": "plain issue", "labels": []},
        }

        self.assertIsNone(router.determine_persona(event))

    def test_build_prompt_includes_docs_and_comments(self) -> None:
        event = {
            "repository": {"full_name": "anicolao/conductor"},
            "issue": {
                "number": 7,
                "title": "Implement the MVP",
                "body": "@conductor build it",
                "labels": [{"name": "persona: conductor"}],
            },
            "comment": {
                "body": "@coder please implement it",
                "created_at": "2026-04-08T00:00:00Z",
                "user": {"login": "octocat"},
            },
        }
        comments = [
            {
                "body": "@conductor start here",
                "created_at": "2026-04-08T00:00:00Z",
                "user": {"login": "octocat"},
            }
        ]

        prompt = router.build_prompt(
            Path("/home/runner/work/conductor/conductor"),
            "conductor",
            event,
            comments,
        )

        self.assertIn("You are `@conductor`", prompt)
        self.assertIn("BEGIN README.md", prompt)
        self.assertIn("BEGIN MVP_DESIGN.md", prompt)
        self.assertIn("Issue comment history:", prompt)
        self.assertIn("@conductor start here", prompt)

    def test_main_writes_outputs(self) -> None:
        event = {
            "issue": {
                "number": 9,
                "title": "Need help",
                "body": "@conductor investigate",
                "labels": [],
            }
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            event_path = Path(temp_dir) / "event.json"
            output_path = Path(temp_dir) / "output.txt"
            event_path.write_text(json.dumps(event), encoding="utf-8")
            subprocess.run(
                [
                    "python3",
                    "/home/runner/work/conductor/conductor/scripts/conductor/router.py",
                    "--event-path",
                    str(event_path),
                    "--output",
                    str(output_path),
                ],
                check=True,
            )
            output = output_path.read_text(encoding="utf-8")
            self.assertIn("should_run<<CONDUCTOR_EOF", output)
            self.assertIn("persona<<CONDUCTOR_EOF", output)


if __name__ == "__main__":
    unittest.main()
