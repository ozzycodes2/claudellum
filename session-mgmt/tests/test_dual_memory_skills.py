"""Structural tests for the dual-memory session skills.

write-handoff, read-handoff and recall-focus must ask trivia and Hindsight at
the same steps, so a Hindsight vs trivia comparison measures recall rather than
which store the instructions happened to name. These tests pin that pairing and
the ordering rules the skills depend on. Run with:

    python3 session-mgmt/tests/test_dual_memory_skills.py

`unittest discover` does not work on this directory: it has no __init__.py, and
Python refuses a start directory that is not importable.
"""
import re
import unittest
from pathlib import Path

_SKILLS_DIR = Path(__file__).resolve().parents[1] / "skills"

SKILLS = ("write-handoff", "read-handoff", "recall-focus")


def _skill(name: str) -> tuple[dict, str]:
    """Return (frontmatter, body) of a skill's SKILL.md.

    Reads only the frontmatter shapes the skills use: `key: value` lines and
    `key: >-` folded blocks.
    """
    text = (_SKILLS_DIR / name / "SKILL.md").read_text()
    match = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
    if not match:
        raise AssertionError(f"{name}: SKILL.md has no frontmatter")
    head, body = match.groups()
    fm: dict = {}
    key = None
    for line in head.splitlines():
        top = re.match(r"([A-Za-z][\w-]*):\s*(.*)", line)
        if top and not line.startswith(" "):
            key, value = top.groups()
            fm[key] = "" if value in (">-", ">", "|") else value.strip().strip('"')
        elif key and line.startswith(" "):
            fm[key] = (fm[key] + " " + line.strip()).strip()
    return fm, body


def _assert_before(case: unittest.TestCase, body: str, first: str, second: str) -> None:
    """Assert `first` occurs and its first occurrence precedes the first `second`."""
    i, j = body.find(first), body.find(second)
    case.assertNotEqual(i, -1, f"{first!r} missing")
    case.assertNotEqual(j, -1, f"{second!r} missing")
    case.assertLess(i, j, f"{first!r} must come before {second!r}")


class CommonShape(unittest.TestCase):
    def test_name_matches_dir(self):
        for name in SKILLS:
            with self.subTest(skill=name):
                fm, _ = _skill(name)
                self.assertEqual(fm.get("name"), name)
                self.assertTrue(fm.get("description"))

    def test_under_500_lines(self):
        for name in SKILLS:
            with self.subTest(skill=name):
                lines = (_SKILLS_DIR / name / "SKILL.md").read_text().count("\n")
                self.assertLess(lines, 500)

    def test_contribution_line(self):
        for name in SKILLS:
            with self.subTest(skill=name):
                _, body = _skill(name)
                self.assertIn("Sources — trivia:", body)
                self.assertIn("· Hindsight:", body)

    def test_independent_gates(self):
        for name in SKILLS:
            with self.subTest(skill=name):
                _, body = _skill(name)
                self.assertIn("trivia-bootstrapped", body)
                self.assertIn("mcp__hindsight__", body)

    def test_skip_note_per_store(self):
        # A store that is unavailable is skipped with a note; the other still runs.
        for name in SKILLS:
            with self.subTest(skill=name):
                low = _skill(name)[1].lower()
                self.assertIn("trivia unavailable", low)
                self.assertIn("hindsight unavailable", low)
                self.assertIn("the other store still runs", low)

    def test_repo_slug_from_common_dir(self):
        for name in SKILLS:
            with self.subTest(skill=name):
                self.assertIn("--git-common-dir", _skill(name)[1])

    def test_no_private_names(self):
        for name in SKILLS:
            with self.subTest(skill=name):
                text = (_SKILLS_DIR / name / "SKILL.md").read_text().lower()
                for word in ("machinify", "vlognow", "clasp"):
                    self.assertNotIn(word, text)


class WriteHandoff(unittest.TestCase):
    def setUp(self):
        self.fm, self.body = _skill("write-handoff")

    def test_pointer_and_ingest_paired(self):
        self.assertIn('mnemonic = "<slug>/handoff"', self.body)
        self.assertIn("hindsight_ingest_document", self.body)

    def test_focus_and_initiative_paired(self):
        self.assertIn("current-focus", self.body)
        self.assertIn("hindsight_capture_initiative", self.body)

    def test_redact_before_stores(self):
        _assert_before(self, self.body, "Redact", "memorize(")
        _assert_before(self, self.body, "Redact", "hindsight_ingest_document(")

    def test_destination_rule(self):
        for s in ("./tmp/", ".claude/relay/", "handoff-<yyyy-mm-dd>-<hhmm>.md"):
            self.assertIn(s, self.body)

    def test_template_sections(self):
        for s in ("## Task", "## State", "## Key decisions", "## Artifacts",
                  "## Verify state", "## Watch out for", "## For skill-aware agents"):
            self.assertIn(s, self.body)

    def test_points_at_read_handoff(self):
        self.assertIn("read-handoff", self.body)

    def test_explicit_only(self):
        self.assertIn("never", self.fm["description"].lower())


class ReadHandoff(unittest.TestCase):
    def setUp(self):
        self.fm, self.body = _skill("read-handoff")

    def test_locate_paired(self):
        self.assertIn('recall("<slug>/handoff"', self.body)
        _assert_before(self, self.body, "hindsight_search_knowledge_pages", "./tmp/handoff-")

    def test_file_is_authority(self):
        low = self.body.lower()
        self.assertRegex(low, r"only if the file (it names )?exists|file must exist|file exists")
        self.assertIn("filename timestamp", low)

    def test_drift_check(self):
        self.assertIn("git log --oneline <handoff-sha>..HEAD", self.body)

    def test_invokes_recall_focus(self):
        self.assertIn("recall-focus", self.body)

    def test_cleanup_paired(self):
        self.assertIn("consumed", self.body)
        self.assertIn("Correction: handoff consumed", self.body)


class RecallFocus(unittest.TestCase):
    def setUp(self):
        self.fm, self.body = _skill("recall-focus")

    def test_seed_recalls_paired(self):
        self.assertIn('"<slug>/current-focus"', self.body)
        self.assertIn('"<slug>/conventions"', self.body)
        self.assertIn("hindsight_search_knowledge_pages", self.body)

    def test_probe_paired(self):
        self.assertIn("full_text_search", self.body)
        self.assertRegex(self.body, r"hindsight_search_knowledge_pages\([^)]*NEXT")

    def test_reflect_last_resort(self):
        _assert_before(self, self.body, "hindsight_search_knowledge_pages", "hindsight_reflect")

    def test_rate_and_credit_paired(self):
        self.assertIn("rate", self.body)
        self.assertIn("From Hindsight memory", self.body)

    def test_single_tag_rule(self):
        self.assertIn("One tag per", self.body)

    def test_verify_next_claims(self):
        self.assertIn("git fetch", self.body)
        self.assertIn("gh run list --commit", self.body)

    def test_plan_mode(self):
        self.assertIn("plan mode", self.body)


if __name__ == "__main__":
    unittest.main()
