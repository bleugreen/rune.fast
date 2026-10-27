#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb"]
# ///
"""
Writes data/harness.json, the harness page's data, from the rs project's DuckDB export.

    uv run scripts/harness/extract.py <export.duckdb>            # write data/harness.json
    uv run scripts/harness/extract.py <export.duckdb> --verify   # check every source still resolves

It keeps only what the figures draw. Times are UTC epoch seconds (the page renders them in
Pacific time through src/lib/time.ts); senders are plain ids such as 'rs/3 coordinator',
never addresses. Quoted excerpts are picked by id below. Before writing, the whole file is
scanned with the public identifier list (scripts/forbidden.ts) and the taught addresses
(src/harness/addresses.ts): any other cairn:// address, any forbidden identifier and any email
address refuses the write.

Caution: the export's DuckDB session prints to_timestamp in Pacific time; this script never
uses it, and does all clock arithmetic on the epoch seconds.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "harness.json"
PACIFIC = ZoneInfo("America/Los_Angeles")

# ---------------------------------------------------------------------------
# The public rules, read from their one home in the TypeScript tree.


def taught_addresses() -> list[str]:
    src = (ROOT / "src" / "harness" / "addresses.ts").read_text()
    return re.findall(r"'(cairn:[^']+)'", src)


def forbidden_patterns() -> list[tuple[str, re.Pattern[str]]]:
    src = (ROOT / "scripts" / "forbidden.ts").read_text()
    out = []
    for name, body, flags in re.findall(r"\['([^']+)',\s*/(.+?)/([a-z]*)\]", src):
        out.append((name, re.compile(body, re.I if "i" in flags else 0)))
    if len(out) < 8:
        sys.exit("extract: could not read the patterns in scripts/forbidden.ts")
    return out


EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", re.I)
ADDRESS_CHAR = re.compile(r"[\w\-./~?=&%#:]")


def without_taught(text: str, taught: list[str]) -> str:
    """The same blanking as withoutAddresses in scripts/forbidden.ts: whole addresses only."""
    for a in sorted(taught, key=len, reverse=True):
        at = text.find(a)
        while at >= 0:
            nxt = text[at + len(a) : at + len(a) + 1]
            if nxt and ADDRESS_CHAR.match(nxt):
                at = text.find(a, at + 1)
            else:
                text = text[:at] + " " * len(a) + text[at + len(a) :]
                at = text.find(a, at + len(a))
    return text


def refuse_unpublishable(text: str) -> None:
    scanned = without_taught(text, taught_addresses())
    hits = []
    for name, rx in forbidden_patterns():
        m = rx.search(scanned)
        if m:
            hits.append(f"{name}: …{scanned[max(0, m.start() - 50) : m.end() + 30]}…")
    m = EMAIL.search(scanned)
    if m:
        hits.append(f"email address: …{scanned[max(0, m.start() - 30) : m.end() + 10]}…")
    if hits:
        sys.exit("extract: refusing to write data/harness.json:\n  " + "\n  ".join(hits))


# ---------------------------------------------------------------------------
# Words and times.


def pac(t: int) -> dt.datetime:
    return dt.datetime.fromtimestamp(t, PACIFIC)


def clock(t: int, seconds: bool = False) -> str:
    """'2:37 PM' or '4:14:43 AM', as src/lib/time.ts writes it, with no zone."""
    d = pac(t)
    s = f":{d.second:02d}" if seconds else ""
    return f"{d.hour % 12 or 12}:{d.minute:02d}{s} {'AM' if d.hour < 12 else 'PM'}"


def day(t: int) -> str:
    """'Tue 20 Oct'."""
    d = pac(t)
    return f"{d:%a} {d.day} {d:%b}"


def when(t: int, seconds: bool = False) -> str:
    return f"{day(t)}, {clock(t, seconds)}"


def plain_id(uri: str | None) -> str:
    """'cairn://p/rs/158/2/coordinator' -> 'rs/158 coordinator'; 'cairn://p/rs/main' -> 'main'."""
    if not uri:
        return "unknown"
    if uri == "system":
        return "the harness"
    m = re.match(r"cairn://p/rs/(\d+)/\d+/([\w-]+)(?:/task/([\w-]+))?", uri)
    if m:
        return f"rs/{m[1]} {m[3] + ' task' if m[3] else m[2]}"
    m = re.match(r"cairn://p/rs/([a-z][\w-]*)(?:/task/([\w-]+))?", uri)
    if m:
        return f"{m[1]}'s {m[2]} task" if m[2] else m[1]
    return uri.replace("cairn://p/", "")


def first_words(text: str, limit: int = 110) -> str:
    """The message's opening, to its first sentence end or line break, at most `limit` characters."""
    s = text.strip().split("\n")[0].strip()
    m = re.match(r"(.+?[.!?])(?:\s|$)", s)
    s = m[1] if m and len(m[1]) <= limit else s
    if len(s) > limit:
        s = s[:limit].rsplit(" ", 1)[0] + "…"
    return s.replace("**", "")


# ---------------------------------------------------------------------------
# The objects the page is drawn from, picked by id.

ISSUE = 843
WRITE_333 = "db32a52a-8b5f-4079-89ba-92db4ae8957f"  # main's four-item write, Tue 20 Oct 3:33:27 PM

# The four minutes around rs/3 on Tuesday evening, in order (Fig 7).
RS3_STEPS = [
    ("report", "messages", "204642f3-2cd4-4a18-8f4e-3e649ec2e1c6"),
    ("question", "ev", "76e34ce7-43c"),  # the questions append; resolved to its full id below
    ("answer", "turns", None),  # the prompt_response turn that followed it
    ("start", "executions", None),  # rs/3's starts of rs/22 and rs/23 (execution 1 of each)
    ("decision", "messages", "668f34d7-179b-48f0-a9fb-fc328e0986c8"),
    ("fanout", "messages", None),  # rs/3 to its children, 6:39:35 to 6:39:36 PM
    ("report", "messages", "869fa2c8-b795-4a80-aa53-76034fbc3b47"),
    ("confirm", "messages", "b64efb79-519a-4dca-8472-3488ea96248b"),
]

GIT_TAGS = ("[Base branch update]", "[Branch update]", "[Divergent history]")

# Messages from the app itself that arrive as user events; the operator did not type them.
APP_PREFIXES = ("<local-command-stdout>", "Your response above was", "[Request interrupted by user")


class Export:
    def __init__(self, path: str):
        self.con = duckdb.connect(path, read_only=True)

    def all(self, sql: str, *args):
        return self.con.execute(sql, list(args)).fetchall()

    def one(self, sql: str, *args):
        rows = self.all(sql, *args)
        if len(rows) != 1:
            sys.exit(f"extract: expected one row, got {len(rows)}: {sql[:120]} {args}")
        return rows[0]

    def val(self, sql: str, *args):
        return self.one(sql, *args)[0]


# ---------------------------------------------------------------------------


def extract(x: Export) -> dict:
    sources: dict[str, list[dict]] = collections.defaultdict(list)

    def src(fig: str, table: str, key, plain: str) -> None:
        sources[fig].append({"table": table, "id": key, "plain": plain})

    main_id, main_created = x.one("select id, created_at from threads where name='main'")
    export_end = x.val("select max(timestamp) from ev")

    # --- totals -------------------------------------------------------------
    user_rows = x.all("select content, thread_id is not null, timestamp, thread_id from ev where event_type='user'")
    typed = [r for r in user_rows if not (r[0] or "").strip().startswith(APP_PREFIXES)]
    verbs = dict(
        x.all(
            "select replace(tool,'mcp__cairn__',''), count(*) from ev "
            "where tool in ('mcp__cairn__read','mcp__cairn__write','mcp__cairn__run') group by 1"
        )
    )
    system_msgs = x.val("select count(*) from messages where sender_name='system'")
    messages = x.val("select count(*) from messages")
    merges_by: dict[str, set] = collections.defaultdict(set)
    for tin, node, thread in x.all(
        "select e.tool_input, e.node_name, t.name from ev e left join threads t on t.id=e.thread_id "
        "where e.tool='mcp__cairn__write' and e.tool_input like '%merge%'"
    ):
        try:
            changes = json.loads(tin).get("changes") or []
        except (json.JSONDecodeError, AttributeError):
            continue
        for ch in changes:
            p = ch.get("payload")
            if isinstance(p, dict) and p.get("action") == "merge":
                who = thread if thread else ("coordinators" if node == "Coordinator" else (node or "other"))
                merges_by[who].add(ch.get("target"))

    totals = {
        "threads": x.val("select count(*) from threads"),
        "issues": x.val("select count(*) from issues"),
        "topLevelIssues": x.val("select count(*) from issues where parent_issue_id is null"),
        "childIssues": x.val("select count(*) from issues where parent_issue_id is not null"),
        "coordinatorFiled": x.val(
            "select count(*) from issues i join jobs j on j.id=i.parent_job_id where j.node_name='Coordinator'"
        ),
        "jobs": x.val("select count(*) from jobs"),
        "executions": x.val("select count(*) from executions"),
        "reviewJobs": x.val("select count(*) from jobs where node_name='Review'"),
        "exploreTasks": x.val("select count(*) from jobs where agent_config_id='Explore'"),
        "messages": messages,
        "systemMessages": system_msgs,
        "agentMessages": messages - system_msgs,
        "verbCalls": sum(verbs.values()),
        "verbs": verbs,
        "operators": 1,
        "operatorMessages": len(typed),
        "operatorToThreads": sum(1 for r in typed if r[1]),
        "appUserEvents": len(user_rows) - len(typed),
        "carets": sum(1 for r in typed if (r[0] or "").strip() == "^"),
        "caretsToThreads": sum(1 for r in typed if r[1] and (r[0] or "").strip() == "^"),
        "operatorAnswers": x.val("select count(*) from turns where start_reason='prompt_response'"),
        "permissionAnswers": x.val("select count(*) from turns where start_reason='permission_response'"),
        "tenetVerdicts": x.val("select count(*) from tenets where answered_at is not null"),
        "backstops": x.val(
            "select count(*) from messages where sender_name='system' and content like 'Coordinator check-in backstop%'"
        ),
        "terminalExit": x.val("select count(*) from messages where sender_name='system' and content like '[Terminal exit]%'"),
        "terminalOutput": x.val(
            "select count(*) from messages where sender_name='system' and content like '[Terminal output match]%'"
        ),
        "mergesBy": {k: len(v) for k, v in sorted(merges_by.items(), key=lambda kv: -len(kv[1]))},
        "mergedPrs": x.val("select count(*) from merge_requests where status='merged'"),
        "start": main_created,
        "end": export_end,
    }
    src("head", "threads", "main", f"the rs project's main thread, created {when(main_created)}")
    src("head", "export", "issues", "the rs project's export: its 900 issues, 2,481 agent jobs and 35,598 messages")

    # --- Fig 1: the address ---------------------------------------------------
    iid, title, filed, merged_at = x.one("select id, title, created_at, merged_at from issues where number=?", ISSUE)
    eid, eseq, recipe_id, e_start = x.one("select id, seq, recipe_id, started_at from executions where issue_id=?", iid)
    bj, b_start, b_end = x.one(
        "select id, started_at, completed_at from jobs where issue_id=? and node_name='Builder'", iid
    )
    turn_rows = x.all(
        "select id::varchar, sequence, start_reason, started_at from turns where job_id=? order by sequence", bj
    )
    versions = x.all(
        "select id, version, created_at from artifacts where job_id=? and output_name='create-pr' order by version", bj
    )
    pr_no, pr_opened, pr_merged = x.one(
        "select github_pr_number, opened_at, merged_at from merge_requests where issue_id=?", iid
    )
    title_short = re.split(r" \(", title)[0]
    address = {
        "issue": ISSUE,
        "title": title_short,
        "filed": filed,
        "execution": eseq,
        "recipe": recipe_id,
        "node": "builder",
        "turns": len(turn_rows),
        "start": b_start,
        "end": b_end,
        "artifact": "create-pr",
        "versions": len(versions),
        "pr": pr_no,
        "merged": pr_merged,
    }
    src("address", "issues", ISSUE, f"issue rs/843, filed {when(filed)} and merged {when(merged_at)}")
    src("address", "executions", str(eid), f"issue rs/843, execution {eseq} (the {recipe_id} recipe)")
    src("address", "jobs", str(bj), f"issue rs/843, its builder, {when(b_start)} to {clock(b_end)}")
    src("address", "merge_requests", pr_no, f"issue rs/843, pull request #{pr_no}, merged {when(pr_merged)}")

    # --- Fig 2: lifelines ------------------------------------------------------
    threads = []
    for tid, name, created in x.all("select id, name, created_at from threads order by created_at"):
        threads.append(
            {
                "name": name,
                "created": created,
                "operator": sorted(r[2] for r in typed if r[3] == tid),
                "filed": [
                    r[0] for r in x.all("select created_at from issues where parent_thread_id=? order by 1", tid)
                ],
            }
        )
        src("lifelines", "threads", name, f"the {name} thread, created {when(created)}")
    coord_filed = [
        r[0]
        for r in x.all(
            "select i.created_at from issues i join jobs j on j.id=i.parent_job_id "
            "where j.node_name='Coordinator' order by 1"
        )
    ]
    rs3_created = x.val("select created_at from issues where number=3")
    lifelines = {
        "threads": threads,
        "coordinators": coord_filed,
        "marks": {"rs3": rs3_created, "rs843": filed},
    }
    src("lifelines", "issues", 3, f"issue rs/3, the quest-route coordinator, filed under main {when(rs3_created)}")

    # --- Fig 3: rs/843 from filing to merge ------------------------------------
    comments = x.all("select id, seq, created_at from comments where issue_id=? order by seq", iid)
    review = x.one(
        "select id, seq, created_at from comments where issue_id=? and content like 'Final independent review approved%'",
        iid,
    )
    ev_rows = x.all(
        "select timestamp, sequence, event_type, tool, turn_id, content from ev where job_id=? order by timestamp, sequence",
        bj,
    )
    results = [r[0] for r in ev_rows if r[2].startswith("result:")]
    turns = []
    for i, (tid, seq, reason, started) in enumerate(turn_rows):
        nxt = turn_rows[i + 1][3] if i + 1 < len(turn_rows) else None
        end = next((t for t in results if t >= started and (nxt is None or t <= nxt)), None)
        brief = next(
            (r[5] for r in ev_rows if r[4] == tid and r[2] == "attention:briefing" and r[5]), None
        )
        senders = []
        if brief:
            body = json.loads(brief).get("resolved", "")
            for m in re.findall(r"\[Direct message from (\S+?)\]", body):
                p = plain_id(m)
                if p not in senders:
                    senders.append(p)
        waited = None
        tests = False
        if reason == "wait_resolved":
            prev_tid = turn_rows[i - 1][0]
            runs = [r for r in x.all(
                "select tool_input from ev where job_id=? and turn_id=? and tool='mcp__cairn__run' order by timestamp",
                bj, prev_tid,
            )]
            if runs:
                commands = json.loads(runs[-1][0])["commands"]
                waited = commands[0].get("description")
                tests = any("bun test" in (c.get("command") or "") for c in commands)
        turns.append(
            {"n": seq, "start": started, "end": end, "reason": reason, "senders": senders, "waitedOn": waited,
             "waitedOnTests": tests}
        )
    calls = [
        {"t": r[0], "verb": r[3].replace("mcp__cairn__", "")}
        for r in ev_rows
        if r[3] in ("mcp__cairn__read", "mcp__cairn__write", "mcp__cairn__run")
    ]
    snapshot = json.loads(x.val("select snapshot from executions where id=?", eid))
    merger = x.val(
        "select t.name from ev e join threads t on t.id=e.thread_id where e.tool='mcp__cairn__write' "
        "and e.tool_input like ? and e.tool_input like '%\"merge\"%' order by e.timestamp limit 1",
        "%rs/843/1/builder/create-pr%",
    )
    issue843 = {
        "filed": filed,
        "comments": [c[2] for c in comments],
        "start": b_start,
        "end": b_end,
        "turns": turns,
        "calls": calls,
        "versions": [v[2] for v in versions],
        "review": review[2],
        "reviewer": plain_id(
            json.loads(x.val("select author_principal_json from issues where id=?", iid)).get("node")
        ),
        "prOpened": pr_opened,
        "merged": pr_merged,
        "mergedBy": merger,
        "pr": pr_no,
        "recipe": recipe_nodes(snapshot),
    }
    src("issue843", "comments", str(comments[0][0]), f"issue rs/843, comments 1 to {len(comments)}, {when(comments[0][2])} to {when(comments[-1][2])}")
    src("issue843", "jobs", str(bj), f"issue rs/843, its builder's {len(turns)} turns and {len(calls)} verb calls, {day(b_start)}, {clock(b_start)} to {clock(b_end)}")
    src("issue843", "artifacts", str(versions[-1][0]), f"issue rs/843, the builder's pull request, versions 1 to {len(versions)}, {clock(versions[0][2])} to {clock(versions[-1][2])}")
    src("issue843", "comments", str(review[0]), f"issue rs/843, comment {review[1]}, the final review approval, {when(review[2])}")
    src("issue843", "merge_requests", pr_no, f"pull request #{pr_no}, merged by the {merger} thread {when(pr_merged)}")
    src("issue843", "executions", str(eid), "issue rs/843, execution 1's stored recipe")

    # --- Fig 4: recipes --------------------------------------------------------
    recipes = []
    groups: dict[str, list] = collections.defaultdict(list)
    for rid, snap, ex_id in x.all("select recipe_id, snapshot, id from executions order by started_at"):
        groups["thread" if rid.startswith("host-") else rid].append((snap, ex_id))
    for rid, rows in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        snap, ex_id = rows[0]
        recipes.append({"id": rid, "executions": len(rows), "nodes": recipe_nodes(json.loads(snap)) if snap else []})
        src("recipes", "executions", str(ex_id), f"the {rid} recipe as stored with its first execution, and its {len(rows)} executions")

    # --- Fig 5: one write, four items -----------------------------------------
    w_t, w_in = x.one("select timestamp, tool_input from ev where id=?", WRITE_333)
    items = json.loads(w_in)["changes"]
    for it in items:
        p = it.get("payload") or {}
        if "description" in p and isinstance(p.get("title"), str):
            p["description"] = p["description"].split("\n")[0] + " ..."
    rs1_t = x.val("select created_at from issues where number=1")
    write333 = {"t": w_t, "items": items, "filed": {"issue": 1, "t": rs1_t}}
    src("write333", "ev", WRITE_333, f"the main thread's write, {when(w_t, True)}")
    src("write333", "issues", 1, f"issue rs/1, filed by that write {when(rs1_t, True)}")

    # --- Fig 6: verbs by role --------------------------------------------------
    role_of = {"Builder": "builders", "Coordinator": "coordinators", "thread": "threads"}
    verbs_by: dict[str, dict] = collections.defaultdict(lambda: {"read": 0, "write": 0, "run": 0})
    for node, agent, tool, n in x.all(
        "select j.node_name, j.agent_config_id, replace(e.tool,'mcp__cairn__',''), count(*) from ev e "
        "left join jobs j on j.id=e.job_id where e.tool in ('mcp__cairn__read','mcp__cairn__write','mcp__cairn__run') "
        "group by 1,2,3"
    ):
        role = role_of.get(node) or ("tasks" if agent == "Explore" else "other")
        verbs_by[role][tool] += n
    verbs_by_role = [{"role": r, **verbs_by[r]} for r in ("builders", "coordinators", "threads", "tasks", "other")]
    src("verbs", "export", "ev", "every read, write and run call in the export's agent transcripts, by the job that made it")

    # --- Fig 7: rs/3, four minutes ---------------------------------------------
    rs3_iid = x.val("select id from issues where number=3")
    rs3_job = x.val("select id from jobs where issue_id=? and node_name='Coordinator'", rs3_iid)
    children = [r[0] for r in x.all("select number from issues where parent_issue_id=? order by number", rs3_iid)]

    def message(mid: str) -> dict:
        t, sender, content, rjob = x.one(
            "select m.created_at, m.sender_name, m.content, r.job_id from messages m "
            "left join runs r on r.id=m.recipient_run_id where m.id=?",
            mid,
        )
        return {"t": t, "from": plain_id(sender), "to": [recipient(x, rjob)], "words": first_words(content), "id": mid}

    steps = []
    for kind, table, key in RS3_STEPS:
        if kind == "question":
            qid, qt, qin = x.one("select id, timestamp, tool_input from ev where id like ?", key + "%")
            qd = json.loads(qin)["changes"][0]["payload"]["questions"][0]
            steps.append(
                {"kind": kind, "t": qt, "from": "rs/3 coordinator", "to": ["the operator"],
                 "words": "Should I start them?", "options": [o["label"] for o in qd["options"]], "id": qid}
            )
            question_t = qt
        elif kind == "answer":
            tid, at = x.one(
                "select id::varchar, started_at from turns where job_id=? and start_reason='prompt_response' "
                "and started_at between ? and ?",
                rs3_job, question_t, question_t + 600,
            )
            reply = x.one(
                "select content from ev where job_id=? and turn_id=? and event_type='assistant' order by timestamp limit 1",
                rs3_job, tid,
            )[0]
            answer = "Start both" if reply.startswith("You chose to start both") else None
            if not answer:
                sys.exit("extract: the rs/3 answer is not the one the figure prints")
            steps.append({"kind": kind, "t": at, "from": "the operator", "to": ["rs/3 coordinator"], "words": answer, "id": tid})
        elif kind == "start":
            rows = x.all(
                "select e.id, i.number, e.started_at from executions e join issues i on i.id=e.issue_id "
                "where i.number in (22, 23) and e.seq=1 order by i.number"
            )
            steps.append(
                {"kind": kind, "t": rows[0][2], "from": "rs/3 coordinator", "to": [f"rs/{r[1]}" for r in rows],
                 "words": "rs/3 starts rs/22 and rs/23", "id": str(rows[0][0])}
            )
        elif kind == "fanout":
            rows = x.all(
                "select m.id, m.created_at, m.content, r.job_id from messages m left join runs r on r.id=m.recipient_run_id "
                "where m.sender_name='cairn://p/rs/3/1/coordinator' and m.created_at between ? and ? order by m.created_at",
                steps[-1]["t"] + 60, steps[-1]["t"] + 90,
            )
            kids = [(r, recipient(x, r[3])) for r in rows]
            kids = [(r, to) for r, to in kids if re.fullmatch(r"rs/\d+ builder", to)]
            kids.sort(key=lambda k: (k[0][1], int(re.search(r"\d+", k[1])[0])))
            lead = next(r for r, _ in kids if r[2].startswith("Coordinator (rs/3): two decisions"))
            steps.append(
                {"kind": kind, "t": kids[0][0][1], "from": "rs/3 coordinator",
                 "to": sorted((to for _, to in kids), key=lambda s: int(re.search(r"\d+", s)[0])),
                 "words": first_words(lead[2]), "id": lead[0]}
            )
        else:
            steps.append({"kind": kind, **message(key)})
    executions = {}
    for n in (22, 23):
        executions[n] = [
            {"seq": r[0], "t": r[1], "lifecycle": r[2]}
            for r in x.all(
                "select e.seq, e.started_at, e.lifecycle from executions e join issues i on i.id=e.issue_id "
                "where i.number=? order by e.seq",
                n,
            )
        ]
    rs3 = {"children": children, "steps": steps, "executions": executions}
    src("rs3", "issues", 3, f"issue rs/3 and its {len(children)} child issues")
    for s in steps:
        table = {"question": "ev", "answer": "turns", "start": "executions"}.get(s["kind"], "messages")
        src("rs3", table, s["id"], f"{s['from']} to {', '.join(s['to']) if len(s['to']) < 3 else str(len(s['to'])) + ' child builders'}, {when(s['t'], True)}")

    # --- Fig 8: wakes ------------------------------------------------------------
    kinds = collections.Counter()
    heads = {}
    briefings = 0
    for (content,) in x.all(
        "select content from ev where event_type in ('attention:briefing','system:message') and content like '{%'"
    ):
        b = json.loads(content)
        if not isinstance(b, dict) or "active" not in b:
            continue
        briefings += 1
        for item in b.get("active", []) + b.get("catchup", []):
            kinds[item.get("kind")] += 1
            heads.setdefault(item.get("kind"), item.get("headline"))
    wakes = {
        "briefings": briefings,
        "kinds": [{"kind": k, "headline": heads[k], "n": n} for k, n in kinds.most_common()],
    }
    src("wakes", "export", "ev", f"the {briefings:,} attention briefings the harness opened turns with, and the items in each")
    src("wakes", "export", "messages", "the harness's terminal-exit and terminal-output notices")

    # --- Fig 9: tenets ------------------------------------------------------------
    quoted = {3, 39}
    tenets = []
    for n, status, verdict, origin, created, answered, supersedes, statement, comment, tid in x.all(
        "select number, status, verdict, origin, created_at, answered_at, supersedes, statement, comment, id "
        "from tenets order by number"
    ):
        row = {"n": n, "status": status, "verdict": verdict, "origin": origin, "created": created,
               "answered": answered, "supersedes": supersedes}
        if n in quoted:
            row["statement"] = before_address(statement)
        if status == "declined" and comment:
            row["comment"] = comment
        tenets.append(row)
    src("tenets", "tenets", 39, "rs tenet 39, its statement and verdict")
    src("tenets", "tenets", 3, "rs tenet 3, its statement")
    for n in (8, 27):
        src("tenets", "tenets", n, f"rs tenet {n}, declined, and the operator's comment")
    src("tenets", "export", "tenets", "the rs project's 39 tenets: proposed, answered and superseded")

    # --- Fig 10: git notices --------------------------------------------------------
    days: dict[str, dict] = {}
    for t, content in x.all("select created_at, content from messages where sender_name='system' order by created_at"):
        c = (content or "").lstrip()
        if c.startswith("⛔"):
            cls = "blocking" if any(tag in c[:80] for tag in GIT_TAGS) else None
        else:
            cls = "auto" if c.startswith(GIT_TAGS[:2]) else None
        if not cls:
            continue
        k = pac(t).strftime("%Y-%m-%d")
        d = days.setdefault(k, {"day": k, "t": t, "auto": 0, "blocking": 0})
        d[cls] += 1
    git = {"days": list(days.values())}
    src("git", "export", "messages", "the harness's own messages about branches: base-branch and branch updates, and divergent history")

    # --- quotes in the prose -----------------------------------------------------------
    def quote(key: str, sql_like: str, sender: str, fig: str, cut: str | None = None, first: bool = False) -> dict:
        sql = "select id, created_at, sender_name, content from messages where content like ? and sender_name=?"
        mid, t, s, content = (
            x.all(sql + " order by created_at limit 1", sql_like, sender)[0] if first else x.one(sql, sql_like, sender)
        )
        words = content if cut is None else content[: content.index(cut) + len(cut)]
        src(fig, "messages", mid, f"{plain_id(s)}, {when(t)}")
        return {"key": key, "t": t, "from": plain_id(s), "words": words.strip()}

    quotes = [
        quote("publish", "rs/95: re-writing create-pr (version 3, 07:38)%", "cairn://p/rs/95/1/builder", "friction",
              "didn't help."),
        quote("oneOff", "%rs/95's one-off push is APPROVED%", "cairn://p/rs/main", "friction",
              None),
        quote("backstop", "Coordinator check-in backstop%", "system", "routing", "cannot schedule recurring wakes",
              first=True),
    ]
    one_off = quotes[1]
    one_off["words"] = "rs/95's one-off push is APPROVED"
    hindrance = {
        "key": "hindrance",
        "t": int(dt.datetime(2026, 10, 26, 14, 3, tzinfo=PACIFIC).timestamp()),
        "from": "the operator",
        "words": "bit of a hindrance with all the git state stuff",
    }
    quotes.append(hindrance)
    sources["friction"].append(
        {"table": "external", "id": "rune main chat, turn 10",
         "plain": "the operator to this site's documenting thread, Mon 26 Oct, 2:03 PM"}
    )
    rs302 = [
        {"seq": r[0], "recipe": r[1], "lifecycle": r[2], "t": r[3]}
        for r in x.all(
            "select e.seq, e.recipe_id, e.lifecycle, e.started_at from executions e join issues i on i.id=e.issue_id "
            "where i.number=302 order by e.seq"
        )
    ]
    src("issue843", "issues", 302, "issue rs/302, its three executions")

    return {
        "totals": totals,
        "address": address,
        "lifelines": lifelines,
        "issue843": issue843,
        "recipes": recipes,
        "write333": write333,
        "verbsByRole": verbs_by_role,
        "rs3": rs3,
        "wakes": wakes,
        "tenets": tenets,
        "git": git,
        "quotes": quotes,
        "rs302": rs302,
        "sources": dict(sources),
    }


def before_address(text: str) -> str:
    """The quote's sentences up to the first one that names a cairn:// address, which the page cannot print."""
    at = text.find("cairn://")
    if at < 0:
        return text
    cut = max(text.rfind(". ", 0, at), text.rfind(".\n", 0, at))
    return text[: cut + 1].rstrip() + " …"


def recipient(x: Export, job_id) -> str:
    if job_id is None:
        return "unknown"
    node, number, thread = x.one(
        "select j.node_name, i.number, t.name from jobs j left join issues i on i.id=j.issue_id "
        "left join threads t on t.id=j.thread_id where j.id=?",
        job_id,
    )
    if thread:
        return thread
    return f"rs/{number} {node.lower()}" if node else f"rs/{number} task"


def recipe_nodes(snapshot: dict) -> list[dict]:
    """
    The recipe's nodes in flow order (every edge, control or context, points forward), ties broken
    by where the recipe draws them; each with its name, type and whether it waits for a person.
    """
    r = snapshot["recipe"]
    nodes = {n["id"]: n for n in r["nodes"]}
    drawn = lambda i: ((nodes[i].get("position") or {}).get("y", 0), (nodes[i].get("position") or {}).get("x", 0))
    nxt = collections.defaultdict(set)
    indeg = collections.Counter()
    for e in r["edges"]:
        a, b = e["sourceNodeId"], e["targetNodeId"]
        if a in nodes and b in nodes and a != b and b not in nxt[a]:
            nxt[a].add(b)
            indeg[b] += 1
    order, ready = [], sorted((i for i in nodes if indeg[i] == 0), key=drawn)
    while ready:
        i = ready.pop(0)
        order.append(i)
        for j in nxt[i]:
            indeg[j] -= 1
            if indeg[j] == 0:
                ready.append(j)
        ready.sort(key=drawn)
    order += sorted((i for i in nodes if i not in order), key=drawn)

    def waits(n: dict) -> bool:
        cfg = n.get("artifactConfig") or n.get("actionConfig") or {}
        policy = cfg.get("confirmPolicy") or (cfg.get("inputSchema") or {}).get("confirmPolicy")
        return policy == "user"

    return [{"name": nodes[i]["name"], "type": nodes[i]["nodeType"], "waits": waits(nodes[i])} for i in order]


# ---------------------------------------------------------------------------

KEYS = {
    "issues": "number",
    "tenets": "number",
    "threads": "name",
    "merge_requests": "github_pr_number",
}


def verify(x: Export, data: dict) -> int:
    missing = 0
    checked = 0
    for fig, rows in data["sources"].items():
        for s in rows:
            table, key = s["table"], s["id"]
            if table in ("external", "export"):
                continue
            col = KEYS.get(table, "id")
            cast = "::varchar" if col == "id" else ""
            n = x.val(f"select count(*) from {table} where {col}{cast} = ?", key)
            checked += 1
            if n != 1:
                missing += 1
                print(f"verify: {fig}: {table} {key} resolves to {n} rows ({s['plain']})", file=sys.stderr)
    print(f"verify: {checked} sources checked, {missing} unresolved")
    return 1 if missing else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("export")
    ap.add_argument("--verify", action="store_true", help="check data/harness.json's sources against the export")
    args = ap.parse_args()
    x = Export(args.export)
    if args.verify:
        return verify(x, json.loads(OUT.read_text()))
    data = extract(x)
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    refuse_unpublishable(text)
    OUT.write_text(text + "\n")
    t = data["totals"]
    print(
        f"extract: wrote {OUT.relative_to(ROOT)} ({len(text):,} bytes): {t['issues']} issues, "
        f"{t['verbCalls']:,} verb calls, {sum(len(v) for v in data['sources'].values())} sources"
    )
    return verify(x, data)


if __name__ == "__main__":
    sys.exit(main())
