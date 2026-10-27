"""
Who filed an issue, and where the run's record ends: the one definition the site's extractors share
(scripts/harness/extract.py for /harness, and the home page's tree).

An issue's filer is its author, issues.author_principal_json in the rs project's export: the agent
whose write appended the issue. That is not the issue's parent (parent_issue_id or parent_thread_id),
which says where the issue reports and so routes attention. The two can differ: rs/843 was filed by
rs/158's coordinator and parented to the main thread.

    an agent in an issue    'cairn://p/rs/158/2/coordinator'      -> rs/158, a coordinator
    one of its tasks        'cairn://p/rs/41/1/coordinator/task/x' -> rs/41, a coordinator
    a thread                'cairn://p/rs/main'                   -> the main thread
    a machine principal     (a device id, no node)                -> the harness itself

The export runs on past the #1; RECORD is the moment of the #1, which the site counts to.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# The roles an issue's agents filed under in the run. Any other is new to the site: refuse it, so
# a page never silently counts it with the wrong group.
ROLES = ("coordinator", "builder")

_ISSUE_NODE = re.compile(r"cairn://p/rs/(\d+)/\d+/([a-z][\w-]*)(?:/task/[\w-]+)?")
_THREAD_NODE = re.compile(r"cairn://p/rs/([a-z][\w-]*)(?:/task/[\w-]+)?")


@dataclass(frozen=True)
class Filer:
    kind: str  # 'thread', one of ROLES, or 'harness'
    thread: str | None = None  # the thread's name, when a thread filed it
    issue: int | None = None  # the filing issue's number, when an agent in an issue filed it

    @property
    def plain(self) -> str:
        """'main', 'rs/158 coordinator' or 'the harness'."""
        if self.kind == "thread":
            return self.thread or ""
        if self.kind == "harness":
            return "the harness"
        return f"rs/{self.issue} {self.kind}"


def filer(author_principal_json: str | None) -> Filer:
    a = json.loads(author_principal_json or "{}")
    if a.get("kind") == "machine":
        return Filer("harness")
    node = a.get("node") or ""
    m = _ISSUE_NODE.fullmatch(node)
    if m:
        if m[2] not in ROLES:
            raise ValueError(f"issue_filer: an issue filed by a {m[2]}, a role the site does not count: {node}")
        return Filer(m[2], issue=int(m[1]))
    m = _THREAD_NODE.fullmatch(node)
    if m:
        return Filer("thread", thread=m[1])
    raise ValueError(f"issue_filer: no filer in {author_principal_json!r}")


def record() -> int:
    """The #1, 4:15 AM PDT on Mon 26 Oct 2026, in epoch seconds: the cut in data/summary.json."""
    return int(json.loads((ROOT / "data" / "summary.json").read_text())["cut"])


def issues_filed(con, until: int) -> list[tuple[int, int, Filer]]:
    """(number, created_at, filer) for every issue filed at or before `until`, in filing order."""
    rows = con.execute(
        "select number, created_at, author_principal_json from issues where created_at <= ? order by created_at, number",
        [until],
    ).fetchall()
    return [(n, t, filer(a)) for n, t, a in rows]
