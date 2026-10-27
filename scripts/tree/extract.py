#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb"]
# ///
"""
Writes the story page's hero tree, data/tree.json and data/tree-titles.json, from the rs project's
DuckDB export and the message labels scripts/tree/classify.ts wrote.

    uv run scripts/tree/extract.py <export.duckdb> --kinds <labels.jsonl>...            # write both files
    uv run scripts/tree/extract.py <export.duckdb> --kinds <labels.jsonl>... --verify   # re-query them
    uv run scripts/tree/extract.py <export.duckdb> --texts <texts.json>                 # classify.ts's input

The figure runs from the creation of the main thread to the cut, the #1 (data/summary.json's
`cut`). Its units are the six threads, then the issues filed by the cut, in filing order:

- A thread hangs from main when main made the write that created it (an append to the project's
  threads collection naming it, in the ten minutes before its created_at); otherwise the operator
  opened it and it is a root of its own.
- An issue hangs from whoever filed it, its author: a thread, or the coordinator's or builder's
  issue whose node made the filing. The harness's own filings hang from main.
- A message counts toward the hour of each unit it touches: its sender's run's unit and its
  recipient's (a run's issue, or its job's thread; a channel message's issue or thread). Messages
  between two units are the edges, grouped by sender, recipient and five-minute window.
- A message the classifier read as reporting a problem is a tick on its sender's unit (its
  recipient's when the sender has none).

Times are epoch seconds in the export and seconds from t0 in the file; this script never uses
to_timestamp (the export's DuckDB session prints it in Pacific time). Message ids stay in the file
for traceability; the build drops them (scripts/public-tree.ts).
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "tree.json"
TITLES = ROOT / "data" / "tree-titles.json"
CUT = json.loads((ROOT / "data" / "summary.json").read_text())["cut"]

# The classifier's input: the opening of each message, as it was labelled.
TEXT_CHARS = 700
ORIGIN_WINDOW = 600
EDGE_WINDOW = 300
HOUR = 3600

AGENT_MESSAGES = f"select {{cols}} from messages where sender_name <> 'system' and created_at <= {CUT}"


class Export:
    def __init__(self, path: str):
        self.con = duckdb.connect(path, read_only=True)

    def all(self, sql: str, *args):
        return self.con.execute(sql, list(args)).fetchall()

    def val(self, sql: str, *args):
        rows = self.all(sql, *args)
        if len(rows) != 1:
            sys.exit(f"extract: expected one row, got {len(rows)}: {sql[:120]}")
        return rows[0][0]


def origin_write(x: Export, main_id: str, name: str, created: int) -> str | None:
    """The id of main's write that created thread `name`, if main made one."""
    for wid, tool_input in x.all(
        "select id, tool_input from ev where thread_id::varchar = ? and tool = 'mcp__cairn__write' "
        "and timestamp between ? and ? order by timestamp",
        main_id, created - ORIGIN_WINDOW, created,
    ):
        try:
            changes = json.loads(tool_input).get("changes") or []
        except (json.JSONDecodeError, AttributeError):
            continue
        for ch in changes:
            payload = ch.get("payload") if isinstance(ch, dict) else None
            if (
                ch.get("mode") == "append"
                and ch.get("target") == "cairn://p/rs/threads"
                and isinstance(payload, dict)
                and payload.get("name") == name
            ):
                return str(wid)
    return None


def author(principal: str | None, thread_names: set[str]) -> tuple[str, str | int | None]:
    """('rs/158 coordinator', 158), ('host', 'host') or ('the harness', None) for an issue's author."""
    a = json.loads(principal) if principal else {}
    node = a.get("node") or ""
    m = re.match(r"cairn://p/rs/(\d+)/\d+/(\w+)", node)
    if m:
        return f"rs/{m[1]} {m[2]}", int(m[1])
    m = re.fullmatch(r"cairn://p/rs/([a-z]+)", node)
    if m and m[1] in thread_names:
        return m[1], m[1]
    if a.get("kind") == "machine":
        return "the harness", None
    sys.exit(f"extract: an issue author the tree cannot place: {principal}")


def extract(x: Export, kinds: dict[str, str]) -> tuple[dict, dict]:
    threads_rows = x.all("select id::varchar, name, created_at from threads order by created_at")
    main_id, main_name, t0 = threads_rows[0]
    if main_name != "main":
        sys.exit("extract: the first thread is not main")
    names = {name for _, name, _ in threads_rows}

    unit_of: dict[str, int] = {}  # a thread's or issue's uuid -> its unit index
    threads = []
    for i, (tid, name, created) in enumerate(threads_rows):
        unit_of[tid] = i
        w = origin_write(x, main_id, name, created) if i else None
        row = {"name": name, "s": created - t0, "p": "main" if w else None, "by": "main" if w else "the operator"}
        if w:
            row["w"] = w
        threads.append(row)

    issues = []
    titles = {}
    n_threads = len(threads)
    unit_by_number: dict[int, int] = {}
    issue_rows = x.all(
        "select id::varchar, number, title, created_at, merged_at, closed_at, status, author_principal_json "
        f"from issues where created_at <= {CUT} order by created_at, number"
    )
    for k, (iid, n, title, created, merged, closed, status, principal) in enumerate(issue_rows):
        unit_of[iid] = n_threads + k
        unit_by_number[n] = n_threads + k
        by, parent = author(principal, names)
        if parent is None:
            parent = "main"
        elif isinstance(parent, int) and parent not in unit_by_number:
            sys.exit(f"extract: rs/{n}'s author rs/{parent} is not an earlier issue")
        if merged is not None and merged <= CUT:
            o, e = "m", merged
        elif status == "closed" and closed is not None and closed <= CUT:
            o, e = "c", closed
        else:
            o, e = "o", CUT
        issues.append({"n": n, "p": parent, "s": created - t0, "e": e - t0, "o": o, "by": by})
        titles[str(n)] = title

    life = [(u["s"], CUT - t0) for u in threads] + [(u["s"], u["e"]) for u in issues]

    # A run belongs to its issue, or to its job's thread.
    run_unit: dict[str, int] = {}
    for rid, iid, tid in x.all(
        "select r.id::varchar, r.issue_id::varchar, j.thread_id::varchar from runs r left join jobs j on j.id = r.job_id"
    ):
        u = unit_of.get(iid) if iid else unit_of.get(tid)
        if u is not None:
            run_unit[rid] = u

    hourly: list[collections.Counter] = [collections.Counter() for _ in life]
    edges: collections.Counter = collections.Counter()
    problems = []
    tally = collections.Counter()
    rows = x.all(
        AGENT_MESSAGES.format(cols="id, created_at, sender_run_id::varchar, recipient_run_id::varchar, channel_type, channel_id")
        + " order by created_at, id"
    )
    for mid, t, sr, rr, channel, channel_id in rows:
        su = run_unit.get(sr) if sr else None
        ru = run_unit.get(rr) if rr else None
        if ru is None and channel in ("issue", "thread"):
            ru = unit_of.get(channel_id)
        rel = t - t0
        tally["agent"] += 1
        k = kinds.get(mid)
        if k:
            tally["labelled"] += 1
        touched = {u for u in (su, ru) if u is not None}
        # A message outside a unit's life (a reply landing just after a merge) is not drawn on it.
        alive = {u for u in touched if life[u][0] <= rel <= life[u][1]}
        tally["outside"] += len(touched - alive)
        for u in alive:
            hourly[u][rel // HOUR] += 1
        if su is not None and ru is not None and su != ru and su in alive and ru in alive:
            edges[(su, ru, rel // EDGE_WINDOW)] += 1
        if k == "problem":
            tally["problem"] += 1
            u = su if su is not None else ru
            if u is None or u not in alive:
                tally["problemUndrawn"] += 1
            else:
                problems.append([u, rel, mid])

    def hours(c: collections.Counter) -> list[int]:
        out: list[int] = []
        for h in sorted(c):
            out += [h, c[h]]
        return out

    for u, row in enumerate(threads + issues):
        row["a"] = hours(hourly[u])

    edge_rows = [[a, b, w, n] for (a, b, w), n in sorted(edges.items(), key=lambda kv: (kv[0][2], kv[0][0], kv[0][1]))]
    problems.sort(key=lambda p: (p[1], p[0], p[2]))

    outcomes = collections.Counter(i["o"] for i in issues)
    totals = {
        "exportIssues": x.val("select count(*) from issues"),
        "issues": len(issues),
        "threads": len(threads),
        "threadsFromMain": sum(1 for t in threads if t["p"] == "main"),
        "merged": outcomes["m"],
        "closed": outcomes["c"],
        "open": outcomes["o"],
        "agentMessages": tally["agent"],
        "labelled": tally["labelled"],
        "problem": tally["problem"],
        "problemTicks": len(problems),
        "edgeLines": len(edge_rows),
        "edgeMessages": sum(e[3] for e in edge_rows),
    }
    data = {
        "t0": t0,
        "cut": CUT,
        "totals": totals,
        "threads": threads,
        "issues": issues,
        # [unit a, unit b, five-minute window from t0, messages], by window.
        "edges": delta(edge_rows, 2),
        # [unit, seconds from t0, message id], by time.
        "problems": delta(problems, 1),
    }
    print(
        f"extract: {len(issues)} issues, {len(edge_rows):,} edge lines for {totals['edgeMessages']:,} messages, "
        f"{len(problems):,} problem ticks ({tally['problemUndrawn']} undrawn), "
        f"{tally['outside']} message ends outside their unit's life"
    )
    return data, titles


def delta(rows: list[list], col: int) -> list[list]:
    """Rows sorted on `col`, with that column replaced by its difference from the row before."""
    prev = 0
    out = []
    for r in rows:
        r = list(r)
        r[col], prev = r[col] - prev, r[col]
        out.append(r)
    return out


def undelta(rows: list[list], col: int) -> list[list]:
    acc = 0
    out = []
    for r in rows:
        r = list(r)
        acc += r[col]
        r[col] = acc
        out.append(r)
    return out


def read_kinds(paths: list[str]) -> dict[str, str]:
    kinds: dict[str, str] = {}
    for p in paths:
        for line in Path(p).read_text().splitlines():
            if line.strip():
                row = json.loads(line)
                kinds[row["id"]] = row["k"]
    return kinds


def write_texts(x: Export, path: str) -> None:
    rows = x.all(AGENT_MESSAGES.format(cols="id, content") + " order by created_at, id")
    texts = [{"id": mid, "text": (content or "")[:TEXT_CHARS]} for mid, content in rows]
    Path(path).write_text(json.dumps(texts, ensure_ascii=False))
    print(f"extract: wrote {len(texts):,} message openings to {path}")


# ---------------------------------------------------------------------------


def verify(x: Export, data: dict, titles: dict, kinds: dict[str, str]) -> int:
    bad: list[str] = []
    fresh, fresh_titles = extract(x, kinds)
    if fresh != data:
        for key in data:
            if fresh.get(key) != data.get(key):
                bad.append(f"data/tree.json's {key} is not what the export gives today")
    if fresh_titles != titles:
        bad.append("data/tree-titles.json is not what the export gives today")

    t0 = data["t0"]
    numbers = [i["n"] for i in data["issues"]]
    found = {r[0] for r in x.all(f"select number from issues where created_at <= {CUT}")}
    if set(numbers) != found or len(numbers) != len(found):
        bad.append("the issue numbers are not the export's issues filed by the cut")

    for th in data["threads"]:
        if th["p"] is None:
            continue
        row = x.all("select timestamp, tool_input, thread_id::varchar from ev where id = ?", th["w"])
        created = x.val("select created_at from threads where name = ?", th["name"])
        main_id = x.val("select id::varchar from threads where name = 'main'")
        ok = (
            len(row) == 1
            and row[0][2] == main_id
            and created - ORIGIN_WINDOW <= row[0][0] <= created
            and f'"name":"{th["name"]}"' in row[0][1].replace(" ", "")
        )
        if not ok:
            bad.append(f"thread {th['name']}: its origin write {th['w']} does not resolve to main's write creating it")
        else:
            print(f"verify: {th['name']} was created by main's write {row[0][0] - created:+d} s before it")

    ids = [p[2] for p in undelta(data["problems"], 1)]
    problem_ids = set()
    for mid, sender in x.all(AGENT_MESSAGES.format(cols="id, sender_name")):
        if kinds.get(mid) == "problem":
            problem_ids.add(mid)
    missing = [i for i in ids if i not in problem_ids]
    if missing:
        bad.append(f"{len(missing)} problem ticks name no problem message in the export: {missing[:3]}")
    t = data["totals"]
    if t["problem"] != len(problem_ids):
        bad.append(f"totals.problem {t['problem']} != {len(problem_ids)} problem messages")
    agent = x.val(AGENT_MESSAGES.format(cols="count(*)"))
    if t["agentMessages"] != agent:
        bad.append(f"totals.agentMessages {t['agentMessages']} != {agent}")
    if t["exportIssues"] != x.val("select count(*) from issues"):
        bad.append("totals.exportIssues is not the export's issue count")
    for k, o in (("merged", "m"), ("closed", "c"), ("open", "o")):
        if t[k] != sum(1 for i in data["issues"] if i["o"] == o):
            bad.append(f"totals.{k} does not count the issues")

    for b in bad:
        print(f"verify: {b}", file=sys.stderr)
    print(
        f"verify: {len(numbers)} issues, {len(data['threads'])} threads, {len(ids):,} problem ids against the export "
        f"(t0 {t0}, cut {data['cut']}): {len(bad)} problem(s)"
    )
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("export")
    ap.add_argument("--kinds", nargs="+", default=[], help="label files from scripts/tree/classify.ts")
    ap.add_argument("--verify", action="store_true", help="re-query data/tree.json and data/tree-titles.json")
    ap.add_argument("--texts", help="write the agent messages' openings, classify.ts's input, to this path")
    args = ap.parse_args()
    x = Export(args.export)
    if args.texts:
        write_texts(x, args.texts)
        return 0
    if not args.kinds:
        sys.exit("extract: --kinds is required: the problem ticks are the classifier's labels")
    kinds = read_kinds(args.kinds)
    if args.verify:
        return verify(x, json.loads(OUT.read_text()), json.loads(TITLES.read_text()), kinds)
    data, titles = extract(x, kinds)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    TITLES.write_text(json.dumps(titles, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"extract: wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes) and {TITLES.relative_to(ROOT)}")
    return verify(x, data, titles, kinds)


if __name__ == "__main__":
    sys.exit(main())
