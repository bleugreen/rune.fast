/**
 * Writes data/route-log.json from the swarm's post-run export of attempt 5 (the directory the
 * fleet wrote at 4:16 AM on 26 October, on the operator's Mac):
 *
 *   bun scripts/import-route.ts ~/.rs-fleet/postrun-docs-20261026T1116
 *
 * It checks each file against the export's MANIFEST.json before reading it, keeps only what the
 * Route page draws (src/route/log.ts), drops every error text (they name helper accounts), and
 * refuses to write if the output carries any identifier the site must not publish.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { SKILLS, type LogLevel, type LogSession, type LogStep, type RouteLog, type Skill } from '../src/route/log';
import { findForbidden } from './forbidden';

const OUT = 'data/route-log.json';

interface Row {
  kind?: string;
  runId: string;
  account: string;
  sessionId: number;
  step: string;
  startTick: number;
  endTick: number;
  ticks: number;
  ok: boolean;
  at: string;
  tickMs: number;
  meta: Record<string, unknown>;
}

const fail = (msg: string): never => {
  console.error(`import-route: ${msg}`);
  process.exit(1);
};

const dir = process.argv[2] ?? fail('usage: bun scripts/import-route.ts <postrun-dir>');
const manifest = JSON.parse(readFileSync(join(dir, 'MANIFEST.json'), 'utf8')) as Record<string, { sha256: string }>;

function verified(name: string): string {
  const want = manifest[name]?.sha256 ?? fail(`${name} is not in MANIFEST.json`);
  const buf = readFileSync(join(dir, name));
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== want) fail(`${name}: sha256 ${got} does not match the manifest's ${want}`);
  return buf.toString('utf8');
}

/* The runner's log ------------------------------------------------------- */

const LOG = 'run-sanitized.jsonl';
const rows = verified(LOG)
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Row);
if (rows.some((r) => r.account !== 'SCORED')) fail(`${LOG} holds rows for an account other than the scored one`);
if (rows.some((r) => r.tickMs && r.tickMs !== 400 && r.kind !== 'travel')) fail(`${LOG} has a row off the 400 ms tick`);

const runIds = [...new Set(rows.map((r) => r.runId))];
const runOf = (r: Row) => runIds.indexOf(r.runId);

const sessions: LogSession[] = rows
  .filter((r) => r.kind === 'session')
  .map((r) => {
    const m = r.meta as { firstObservedTick: number; ended: string; logout?: { held?: { fromTick: number } } };
    if (m.ended !== 'logout' && m.ended !== 'relog') fail(`${r.runId} session ${r.sessionId} ended '${m.ended}'`);
    const own = rows.filter((x) => x.runId === r.runId && x.sessionId === r.sessionId);
    const startAt = own.map((x) => x.at).sort()[0]!;
    return {
      run: runOf(r),
      runId: r.runId,
      session: r.sessionId,
      start: r.startTick,
      end: r.endTick,
      firstObserved: m.firstObservedTick,
      ended: m.ended as LogSession['ended'],
      ...(m.logout?.held ? { heldFrom: m.logout.held.fromTick } : {}),
      startAt,
      endAt: r.at,
    };
  });

/*
 * Step rows are the ones with no kind. A step's segments and summaries are zero-tick notes inside it,
 * and a few steps log sub-intervals of themselves (Dragon Slayer's walks and its fight) that the outer
 * row already counts; the page wants the outer intervals, which tile each session.
 */
const timed = rows.filter((r) => r.kind === undefined && r.ticks > 0);
const inside = (a: Row, b: Row) =>
  a !== b && a.runId === b.runId && b.startTick <= a.startTick && a.endTick <= b.endTick && b.ticks > a.ticks;
const steps: LogStep[] = timed
  .filter((r) => !timed.some((o) => inside(r, o)))
  .map((r) => ({ run: runOf(r), session: r.sessionId, label: r.step, start: r.startTick, end: r.endTick, ok: r.ok }))
  .sort((a, b) => a.run - b.run || a.start - b.start);

const skillName = (s: string): Skill =>
  SKILLS.find((k) => k.toLowerCase() === s) ?? fail(`a level-up names an unknown skill '${s}'`);
const levels: LogLevel[] = rows
  .filter((r) => r.kind === 'reach')
  .map((r) => {
    const m = r.meta as { skill: string; level: number };
    return [skillName(m.skill), m.level, runOf(r), r.startTick] as const;
  });

/* The hiscore page ------------------------------------------------------- */

const SCORE = 'official-score.json';
const score = JSON.parse(verified(SCORE)) as {
  player: { at: string; rows: { skill: string; level: string; title: string[] }[] };
};
const ticksOf = (title: string) => {
  const m = /^([\d,]+) ticks normalized to 400 ms per tick$/.exec(title) ?? fail(`hiscore title '${title}'`);
  return Number(m[1]!.replace(/,/g, ''));
};
const overallRow = score.player.rows.find((r) => r.skill === 'Overall') ?? fail('the hiscore page has no Overall row');
const hiscoreSkills = SKILLS.map((skill) => {
  const r = score.player.rows.find((x) => x.skill === skill) ?? fail(`the hiscore page has no ${skill} row`);
  if (r.level !== '99') fail(`${skill} is at ${r.level} on the hiscore page`);
  return { skill, ticks: ticksOf(r.title[0]!) };
}).sort((a, b) => a.ticks - b.ticks);
/** The capture's own instant, to the millisecond, as the timeline writes UTC. */
const capturedAt = new Date(score.player.at).toISOString();

/* Write ------------------------------------------------------------------ */

const log: RouteLog = {
  source: {
    export: basename(dir.replace(/\/+$/, '')),
    files: [
      { name: LOG, sha256: manifest[LOG]!.sha256 },
      { name: SCORE, sha256: manifest[SCORE]!.sha256, at: capturedAt },
    ],
  },
  tickMs: 400,
  sessions,
  steps,
  levels,
  hiscore: { at: capturedAt, overall: ticksOf(overallRow.title[0]!), skills: hiscoreSkills },
};

/** Pretty at the top, one record a line below, so a re-import diffs by record. */
const text =
  '{\n' +
  Object.entries(log)
    .map(([k, v]) =>
      Array.isArray(v)
        ? `  ${JSON.stringify(k)}: [\n${v.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`
        : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`,
    )
    .join(',\n') +
  '\n}\n';

const hit = findForbidden(text);
if (hit) fail(`the output carries a ${hit.what}: …${text.slice(Math.max(0, hit.index - 40), hit.index + 40)}…`);
writeFileSync(OUT, text);
console.log(
  `import-route: ${OUT}: ${sessions.length} sessions, ${steps.length} steps, ${levels.length} level-ups, ` +
    `${hiscoreSkills.length} hiscore stamps (overall ${log.hiscore.overall})`,
);
