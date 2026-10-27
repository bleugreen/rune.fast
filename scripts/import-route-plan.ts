/**
 * Writes data/route-plan.json from the swarm's run order, RUN-ORDER.md in the rs-sdk fork, read
 * through git and never from its working tree (which has had post-run edits):
 *
 *   bun scripts/import-route-plan.ts /Users/<you>/projects/rs-sdk
 *
 * It reads the run order as it stood when attempt 5 logged in, the file's last revision on main
 * before 23:56:33 PDT on 24 October, and fails unless that revision's priced rows are exactly the
 * run commit's: the revisions after the run commit restated the headline for it and added notes
 * beside the rows (the knights' top-ups among them), without moving a row's figure. Nothing is
 * written to the fork. Any row it cannot parse fails the import. Only the figures are kept: the
 * rows' prose names the swarm's machines and accounts, and the page writes its own.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import type { PlanRow, RoutePlan } from '../src/route/log';
import { findForbidden } from './forbidden';

const OUT = 'data/route-plan.json';
const FILE = 'docs/speedrun/RUN-ORDER.md';
/** Attempt 5's run commit of record. */
const RUN_COMMIT = '82f6da3a';
/** Attempt 5's start, as the timeline records it. */
const LOGIN = '2026-10-25T06:56:33Z';

/**
 * Ticks a row says it leaves out of its own figure for the route the run took, priced in the run
 * order's scenario rows instead, in the row's words. Only rows whose route was the one run.
 */
const SCENARIO: Readonly<Record<string, readonly { ticks: number; says: string }[]>> = {
  S18: [{ ticks: 73, says: "the top-ups are the scenario table's +73 line, not this row" }],
  S21: [{ ticks: 143, says: '**The S21 plan in force is the body altar** (main, 15:17 PDT; 0 nature talismans held, F23): +143.0 / +143.0 in every scenario row' }],
  S25d: [{ ticks: 172, says: '+172 in the scenario rows: 263 m' }],
};

const fail = (msg: string): never => {
  console.error(`import-route-plan: ${msg}`);
  process.exit(1);
};

const repo = process.argv[2] ?? fail('usage: bun scripts/import-route-plan.ts <rs-sdk checkout>');
const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });

const revision = git('log', '-1', '--format=%H %cI', `--before=${LOGIN}`, 'main', '--', FILE).trim().split(' ');
const runCommit = git('show', '-s', '--format=%H %cI', RUN_COMMIT).trim().split(' ');
if (revision.length !== 2 || runCommit.length !== 2) fail('could not resolve the revisions');
try {
  git('merge-base', '--is-ancestor', runCommit[0]!, revision[0]!);
} catch {
  fail(`${revision[0]} does not descend from the run commit ${runCommit[0]}`);
}

const NUMBER = /(\d[\d,]*(?:\.\d+)?)/;
const num = (s: string) => Number(s.replace(/,/g, ''));

/** The rev's priced rows; the scenario words are checked only where `scenario` is set, the revision read. */
function table(rev: string, scenarioChecked: boolean): { rows: PlanRow[]; text: string } {
  const text = git('show', `${rev}:${FILE}`);
  const lines = text.split('\n');
  const head = lines.findIndex((l) => l.startsWith('| ID | Kind | Where (tiles) | Step | Levels | Expected | Best |'));
  if (head < 0) fail(`${rev}: no priced table`);
  const rows: PlanRow[] = [];
  for (let i = head + 2; i < lines.length && lines[i]!.startsWith('|'); i++) {
    const line = lines[i]!;
    const c = line.split('|').map((x) => x.trim());
    const id = c[1]!;
    if (!id) continue; // the table's closing total, which section 7 supersedes
    // The leading figure, bold or not, and the tags right after it: '**1,353 m/i**', 'knife 2,978.0 i', '2,026'.
    const e = /^[^\d]{0,12}?(\d[\d,]*(?:\.\d+)?)\**\s*((?:[mier](?:-demo)?)(?:\/[mier])*)?(?![\w])/.exec(c[6]!);
    if (!e) fail(`${rev}:${i + 1} ${id}: no expected figure in '${c[6]!.slice(0, 60)}'`);
    const b = NUMBER.exec(c[7]!);
    const scenario = scenarioChecked ? (SCENARIO[id] ?? []) : [];
    for (const s of scenario) if (!line.includes(s.says)) fail(`${rev}:${i + 1} ${id} no longer says '${s.says}'`);
    rows.push({
      id,
      kind: c[2]!,
      expected: num(e[1]!),
      tags: e[2] ?? '',
      best: b ? num(b[1]!) : null,
      scenario,
      line: i + 1,
    });
  }
  return { rows, text };
}

const atLogin = table(revision[0]!, true);
const atRun = table(runCommit[0]!, false);
const figures = (rows: PlanRow[]) => JSON.stringify(rows.map((r) => [r.id, r.kind, r.expected, r.best, r.tags]));
if (figures(atLogin.rows) !== figures(atRun.rows)) fail(`the priced rows at ${revision[0]} differ from the run commit's`);
for (const id of Object.keys(SCENARIO)) if (!atLogin.rows.some((r) => r.id === id)) fail(`no row ${id}`);

// The headline the revision states for attempt 5 on its run commit.
const headline = atLogin.text.split('\n').findIndex((l) => /^\*\*Fold-in [\w.]+: attempt 5 on its run commit of record, 82f6da3a\b/.test(l));
if (headline < 0) fail('no headline for attempt 5 on the run commit');
const h = /expected (\d[\d,]*\.\d), [\d,.]+ under the record \(best (\d[\d,]*\.\d)\)/.exec(atLogin.text.split('\n')[headline]!);
if (!h) fail('the headline does not state an expected and a best total');

const plan: RoutePlan = {
  source: {
    file: FILE,
    revision: { hash: revision[0]!, at: new Date(revision[1]!).toISOString() },
    runCommit: { hash: runCommit[0]!, at: new Date(runCommit[1]!).toISOString() },
  },
  total: { expected: num(h[1]!), best: num(h[2]!), line: headline + 1 },
  rows: atLogin.rows,
};

const text =
  '{\n' +
  `  "source": ${JSON.stringify(plan.source)},\n` +
  `  "total": ${JSON.stringify(plan.total)},\n` +
  `  "rows": [\n${plan.rows.map((r) => `    ${JSON.stringify(r)}`).join(',\n')}\n  ]\n}\n`;
const hit = findForbidden(text);
if (hit) fail(`the output carries a ${hit.what}: …${text.slice(Math.max(0, hit.index - 40), hit.index + 40)}…`);
writeFileSync(OUT, text);
console.log(`import-route-plan: ${OUT}: ${plan.rows.length} rows from ${revision[0]!.slice(0, 10)}, total ${plan.total.expected}`);
