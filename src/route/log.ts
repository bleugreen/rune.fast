/**
 * The shapes of data/route-log.json and data/route-plan.json, the Route page's two data files.
 *
 * route-log.json is attempt 5's own record of itself, as the swarm's runner wrote it and the
 * post-run export kept it (scripts/import-route.ts): every login session the runner drove, the
 * top-level step intervals inside each, every level-up it observed, and the account's hiscore
 * page as captured after the finish. Ticks in it are on the run clock: each runner launch counts
 * from 0 at its login, and a relog inside one launch carries the count on.
 *
 * route-plan.json is the run order's priced table as it stood when attempt 5 logged in
 * (scripts/import-route-plan.ts): one row per step or leg, with the expected figure the row gives.
 */

/** The 19 skills, as the hiscore page names them. */
export const SKILLS = [
  'Attack',
  'Defence',
  'Strength',
  'Hitpoints',
  'Ranged',
  'Prayer',
  'Magic',
  'Cooking',
  'Woodcutting',
  'Fletching',
  'Fishing',
  'Firemaking',
  'Crafting',
  'Smithing',
  'Mining',
  'Herblore',
  'Agility',
  'Thieving',
  'Runecraft',
] as const;
export type Skill = (typeof SKILLS)[number];

/** The top level of every skill. */
export const MAX_LEVEL = 99;

export interface LogFile {
  name: string;
  sha256: string;
  /** When its content was captured, where the file says (UTC). */
  at?: string;
}

/** One login session the runner drove. */
export interface LogSession {
  /** The runner launch, 0 for the first of attempt 5's ten. */
  run: number;
  runId: string;
  /** 1 for a launch's first session; a relog starts the next. */
  session: number;
  /** Run-clock ticks: the session's first tick (its login) and its last. */
  start: number;
  end: number;
  /** The first tick the runner saw the world on; the ticks before it are the login itself. */
  firstObserved: number;
  ended: 'logout' | 'relog';
  /** A logout the game held back (combat, an open page): from this tick to the end. */
  heldFrom?: number;
  /** UTC: the session's first record, and the runner's closing record of it. */
  startAt: string;
  endAt: string;
}

/** A top-level step interval: rows nested inside another, and zero-length markers, are left out. */
export interface LogStep {
  run: number;
  session: number;
  /** The runner's own name for the step, beginning with its run-order id where it has one. */
  label: string;
  start: number;
  end: number;
  ok: boolean;
}

/** A level-up the runner observed: [skill, level, run, run-clock tick]. */
export type LogLevel = readonly [Skill, number, number, number];

export interface RouteLog {
  source: { export: string; files: readonly LogFile[] };
  /** Milliseconds per tick on the server the run played on. */
  tickMs: number;
  sessions: readonly LogSession[];
  steps: readonly LogStep[];
  levels: readonly LogLevel[];
  /** The account's hiscore page after the finish: each skill's 99, as the tick it was reached. */
  hiscore: { at: string; overall: number; skills: readonly { skill: Skill; ticks: number }[] };
}

/** One row of the run order's priced table. */
export interface PlanRow {
  /** The row's id: S07, T11-12, S24 legs. */
  id: string;
  /** The table's kind column: M measured, I inferred, M/I both; empty for a block row. */
  kind: string;
  /** The Expected column's leading figure, and its m/i/e/r tags. */
  expected: number;
  tags: string;
  /** The Best column's leading figure. */
  best: number | null;
  /** Ticks the row says it leaves to the run order's scenario rows for the route as run, with its words. */
  scenario: readonly { ticks: number; says: string }[];
  /** The row's line in RUN-ORDER.md at the revision read. */
  line: number;
}

export interface RoutePlan {
  source: {
    file: string;
    /** The revision read: the run order's last before the login, and the run commit its rows match. */
    revision: { hash: string; at: string };
    runCommit: { hash: string; at: string };
  };
  /** The headline the revision gives for attempt 5 on the run commit. */
  total: { expected: number; best: number; line: number };
  rows: readonly PlanRow[];
}
