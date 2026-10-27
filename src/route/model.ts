import { resolveRef } from '../attempts/model';
import type { Attempt, Timeline, TimelineEvent } from '../data/types';
import { SKILLS, type LogStep, type PlanRow, type RouteLog, type RoutePlan, type Skill } from './log';
import { BREAK_STORY, SHORT_LOGINS, STEPS, STRETCHES, UNASSIGNED_AT, type StepSpec, type Stretch } from './plan';

/*
 * Attempt 5 on the clock the hiscore keeps. The runner logged every session it drove; the hiscore
 * also counted a few short logins the runner never drove (the timeline records them) and some ticks
 * no log holds. Laid end to end in the order they happened, those three make one clock, and on it
 * every 99 the runner logged lands on the tick the hiscore stamped for it.
 */

export type Levels = Readonly<Record<Skill, number>>;

export interface ShortLogin {
  id: string;
  afterRun: number;
  /** UTC ms. */
  at: number;
  end: number | null;
  /** Ticks the timeline's words give it. */
  ticks: number;
  event: TimelineEvent;
  /** Where it starts on the hiscore's clock, and the unassigned ticks drawn after it. */
  tick: number;
  unassigned: number;
}

export type Segment =
  | { kind: 'session'; from: number; to: number; run: number; session: number }
  | { kind: 'login'; from: number; to: number; login: string }
  | {
      kind: 'unassigned';
      from: number;
      to: number;
      /** The short login it is drawn after. */
      login: string;
      /** The two hiscore stamps it lies between: the first is null before the first stamp. */
      bracket: readonly [Skill | null, Skill];
    };

export interface Stamp {
  skill: Skill;
  /** The hiscore's tick for the skill's 99. */
  tick: number;
}

/** A logged-out stretch, and the short logins inside it, in wall-clock order. */
export type BreakPart =
  | { kind: 'out'; from: number; to: number; logins: readonly ShortLogin[] }
  | { kind: 'in'; login: ShortLogin };

export interface Break {
  index: number;
  /** The hiscore's tick at the logout; the short logins inside add their ticks after it. */
  tick: number;
  /** UTC ms: the runner's logout, and the next runner launch's first record. */
  from: number;
  to: number;
  logins: readonly ShortLogin[];
  parts: readonly BreakPart[];
  /** Logged-in ticks inside the break: the short logins, and the unassigned ticks drawn with them. */
  loginTicks: number;
  unassigned: number;
  story: string;
}

/**
 * A relog inside one runner launch, by plan: the account logs out and straight back in, which
 * costs no ticks. (The log's records around a relog are not in wall-clock order, so it gives no
 * reliable length; the page gives none.)
 */
export interface Relog {
  tick: number;
  run: number;
  session: number;
}

export interface Step {
  spec: StepSpec;
  index: number;
  stretch: Stretch;
  start: number;
  end: number;
  took: number;
  /** The run order's figure for the step: its rows, with what each row leaves to the scenario rows. */
  planned: number;
  rows: readonly PlanRow[];
  /** Of `took`, ticks in runner sessions, in short logins, and unassigned. */
  composition: { session: number; login: number; unassigned: number };
  levelsFrom: Levels;
  levelsTo: Levels;
  /** The hiscore's 99 stamps inside the step. */
  nineties: readonly Stamp[];
  breaks: readonly Break[];
  relogs: readonly Relog[];
}

export interface DriftPoint {
  /** The hiscore's clock, and how far it is ahead of the runner's session clock there. */
  tick: number;
  drift: number;
}

export interface LedgerTerm {
  id: 'unassigned' | 'short-logins' | 'after-finish' | 'residual';
  ticks: number;
}

/**
 * How the swarm's own count and the hiscore's differ, in named terms. The swarm's ledger was its
 * session ticks plus the short logins as it counted them; what the hiscore counted beyond that is
 * the residual the timeline records, and the terms below are the clock's account of it. A term
 * that does not close is kept as a residual, never folded into another.
 */
export interface Ledger {
  hiscore: number;
  swarm: number;
  residual: number;
  sessions: number;
  /** The swarm's short-login term, net of its own conventions: its ledger less its session ticks. */
  swarmLogins: number;
  /** The short logins as the timeline's words count them. */
  logins: number;
  unassigned: number;
  terms: readonly LedgerTerm[];
}

export interface Route {
  tickMs: number;
  finish: number;
  record: number;
  planTotal: number;
  /** The session clock's ticks, the swarm's own count of its runner sessions. */
  sessionTicks: number;
  segments: readonly Segment[];
  /** The hiscore's tick at each runner launch's login. */
  runAt: readonly number[];
  /** The 19 skills in the order they reached 99, with the hiscore's stamp for each. */
  stamps: readonly Stamp[];
  steps: readonly Step[];
  stretches: readonly Stretch[];
  breaks: readonly Break[];
  relogs: readonly Relog[];
  logins: readonly ShortLogin[];
  drift: readonly DriftPoint[];
  /** Each stamp's drift: the hiscore's tick less the runner's own tick for the same 99. */
  stampDrift: readonly (Stamp & { drift: number })[];
  ledger: Ledger;
  /** Level of every skill after every level-up at or before `tick`. */
  levelsAt(tick: number): Levels;
  /** The step a tick falls in (the last step holds the finish). */
  stepAt(tick: number): Step;
}

const START_LEVEL = (s: Skill) => (s === 'Hitpoints' ? 10 : 1);

interface Clock {
  segments: Segment[];
  runAt: number[];
  end: number;
}

function layClock(log: RouteLog, logins: readonly ShortLogin[], extras: ReadonlyMap<string, { ticks: number; bracket: readonly [Skill | null, Skill] }>): Clock {
  const segments: Segment[] = [];
  const runAt: number[] = [];
  const runs = [...new Set(log.sessions.map((s) => s.run))].sort((a, b) => a - b);
  let pos = 0;
  for (const r of runs) {
    if (r !== runAt.length) throw new Error(`The log skips runner launch ${runAt.length}`);
    runAt.push(pos);
    let cursor = 0;
    for (const s of log.sessions.filter((x) => x.run === r).sort((a, b) => a.start - b.start)) {
      if (s.start !== cursor) throw new Error(`Launch ${r}: session ${s.session} starts at ${s.start}, not ${cursor}`);
      segments.push({ kind: 'session', from: pos + s.start, to: pos + s.end, run: r, session: s.session });
      cursor = s.end;
    }
    pos += cursor;
    for (const l of logins.filter((x) => x.afterRun === r)) {
      segments.push({ kind: 'login', from: pos, to: pos + l.ticks, login: l.id });
      pos += l.ticks;
      const x = extras.get(l.id);
      if (x) {
        segments.push({ kind: 'unassigned', from: pos, to: pos + x.ticks, login: l.id, bracket: x.bracket });
        pos += x.ticks;
      }
    }
  }
  return { segments, runAt, end: pos };
}

/** Each skill's 99 as the runner logged it, on a clock. Thieving's was reached in a short login, so it has none. */
function loggedNineties(log: RouteLog, clock: Clock): Map<Skill, number> {
  return new Map(log.levels.filter(([, level]) => level === 99).map(([skill, , run, tick]) => [skill, clock.runAt[run]! + tick]));
}

function shortLogins(a5: Attempt): Omit<ShortLogin, 'tick' | 'unassigned'>[] {
  return SHORT_LOGINS.map((s) => {
    const at = resolveRef(a5, s.at);
    if (!at.event) throw new Error(`Short login ${s.id} must point at an event`);
    if (s.tickWords && !at.event[s.tickWords.field]?.includes(s.tickWords.says)) {
      throw new Error(`Short login ${s.id}: the event does not say '${s.tickWords.says}'`);
    }
    return { id: s.id, afterRun: s.afterRun, at: at.t, end: s.end ? resolveRef(a5, s.end).t : null, ticks: s.ticks, event: at.event };
  });
}

export function buildRoute(log: RouteLog, plan: RoutePlan, timeline: Timeline): Route {
  const a5 = timeline.attempts.find((a) => a.id === 'A5');
  if (!a5) throw new Error('The timeline has no attempt 5');
  const bare = shortLogins(a5).map((l) => ({ ...l, tick: 0, unassigned: 0 }));

  /* The ticks no log holds, interval by interval between the hiscore's stamps. */
  const base = layClock(log, bare, new Map());
  const baseLogged = loggedNineties(log, base);
  const extras = new Map<string, { ticks: number; bracket: readonly [Skill | null, Skill] }>();
  let prev: { skill: Skill | null; stamp: number; pos: number } = { skill: null, stamp: 0, pos: 0 };
  for (const st of [...log.hiscore.skills].sort((a, b) => a.ticks - b.ticks)) {
    const pos = baseLogged.get(st.skill);
    if (pos === undefined) continue;
    const extra = st.ticks - prev.stamp - (pos - prev.pos);
    if (extra < 0) throw new Error(`The log holds ${-extra} more ticks before ${st.skill} 99 than the hiscore counts`);
    if (extra > 0) {
      const at = base.segments.filter(
        (g) => g.kind === 'login' && UNASSIGNED_AT.includes(g.login) && g.from >= prev.pos && g.to <= pos,
      );
      if (at.length !== 1) throw new Error(`${extra} ticks before ${st.skill} 99 have ${at.length} places to go, not one`);
      extras.set((at[0] as Extract<Segment, { kind: 'login' }>).login, { ticks: extra, bracket: [prev.skill, st.skill] });
    }
    prev = { skill: st.skill, stamp: st.ticks, pos };
  }

  const clock = layClock(log, bare, extras);
  const logins: ShortLogin[] = bare.map((l) => {
    const seg = clock.segments.find((g) => g.kind === 'login' && g.login === l.id)!;
    return { ...l, tick: seg.from, unassigned: extras.get(l.id)?.ticks ?? 0 };
  });
  const loginById = new Map(logins.map((l) => [l.id, l]));

  /* Every logged 99 on the hiscore's stamp, and Thieving's inside a short login. */
  const logged = loggedNineties(log, clock);
  const stamps: Stamp[] = [...log.hiscore.skills].sort((a, b) => a.ticks - b.ticks).map((s) => ({ skill: s.skill, tick: s.ticks }));
  for (const s of stamps) {
    const at = logged.get(s.skill);
    if (at === undefined) {
      if (!clock.segments.some((g) => g.kind === 'login' && g.from < s.tick && s.tick <= g.to)) {
        throw new Error(`${s.skill} 99, which no session logged, is not inside a short login`);
      }
    } else if (at !== s.tick) throw new Error(`${s.skill} 99 lands on ${at}, not the hiscore's ${s.tick}`);
  }
  const finish = log.hiscore.overall;
  if (stamps.at(-1)!.tick !== finish) throw new Error('The last 99 is not the overall count');

  /* The rail's levels: each level-up where the clock puts it, and the unlogged 99 at its stamp. */
  const ups = new Map<Skill, [number, number][]>(SKILLS.map((s) => [s, []]));
  for (const [skill, level, run, tick] of log.levels) ups.get(skill)!.push([clock.runAt[run]! + tick, level]);
  for (const s of stamps) if (!logged.has(s.skill)) ups.get(s.skill)!.push([s.tick, 99]);
  for (const xs of ups.values()) xs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const levelsAt = (tick: number): Levels => {
    const out = {} as Record<Skill, number>;
    for (const s of SKILLS) {
      let level = START_LEVEL(s);
      for (const [t, l] of ups.get(s)!) {
        if (t > tick) break;
        level = l;
      }
      out[s] = level;
    }
    return out;
  };

  /* Breaks between runner launches, and relogs inside one. */
  const runs = clock.runAt.length;
  const sessionsOf = (r: number) => log.sessions.filter((s) => s.run === r).sort((a, b) => a.start - b.start);
  const ms = (utc: string) => new Date(utc).getTime();
  if (BREAK_STORY.length !== runs - 1) throw new Error(`${runs - 1} breaks, but ${BREAK_STORY.length} story anchors`);
  const breaks: Break[] = [];
  for (let r = 0; r + 1 < runs; r++) {
    const last = sessionsOf(r).at(-1)!;
    const inside = logins.filter((l) => l.afterRun === r);
    const from = ms(last.endAt);
    const to = ms(sessionsOf(r + 1)[0]!.startAt);
    const parts: BreakPart[] = [];
    let open: { from: number; logins: ShortLogin[] } = { from, logins: [] };
    for (const l of inside) {
      if (l.at < open.from || l.at > to) throw new Error(`Short login ${l.id} is outside its break`);
      if (l.end === null) open.logins.push(l);
      else {
        parts.push({ kind: 'out', from: open.from, to: l.at, logins: open.logins }, { kind: 'in', login: l });
        open = { from: l.end, logins: [] };
      }
    }
    parts.push({ kind: 'out', from: open.from, to, logins: open.logins });
    breaks.push({
      index: r,
      tick: clock.runAt[r]! + last.end,
      from,
      to,
      logins: inside,
      parts,
      loginTicks: clock.runAt[r + 1]! - clock.runAt[r]! - last.end,
      unassigned: inside.reduce((s, l) => s + l.unassigned, 0),
      story: BREAK_STORY[r]!,
    });
  }
  const relogs: Relog[] = log.sessions.flatMap((s) => {
    const next = sessionsOf(s.run).find((x) => x.start === s.end && x.session !== s.session);
    return s.ended === 'relog' && next ? [{ tick: clock.runAt[s.run]! + s.end, run: s.run, session: s.session }] : [];
  });

  /* Steps. */
  const leaves = (run: number, session: number) => log.steps.filter((x) => x.run === run && x.session === session);
  const startOf = (spec: StepSpec): number => {
    const leaf: LogStep | undefined = log.steps.find((x) => x.run === spec.from.run && x.label.startsWith(spec.from.label));
    if (!leaf) throw new Error(`Step ${spec.id}: launch ${spec.from.run} logs no '${spec.from.label}'`);
    const session = log.sessions.find((s) => s.run === leaf.run && s.session === leaf.session)!;
    const first = leaves(leaf.run, leaf.session)[0] === leaf;
    return clock.runAt[leaf.run]! + (first ? session.start : leaf.start);
  };
  const rowById = new Map(plan.rows.map((r) => [r.id, r]));
  const starts = STEPS.map(startOf);
  starts.forEach((t, i) => {
    if (i && t <= starts[i - 1]!) throw new Error(`Step ${STEPS[i]!.id} does not start after the one before it`);
  });
  if (starts[0] !== 0) throw new Error('The first step does not start at the first tick');

  const overlap = (g: Segment, a: number, b: number) => Math.max(0, Math.min(g.to, b) - Math.max(g.from, a));
  const steps: Step[] = STEPS.map((spec, index) => {
    const start = starts[index]!;
    const end = starts[index + 1] ?? finish;
    const rows = spec.rows.map((id) => {
      const r = rowById.get(id);
      if (!r) throw new Error(`Step ${spec.id}: the run order has no row ${id}`);
      return r;
    });
    const stretch = STRETCHES.find((s) => s.id === spec.stretch);
    if (!stretch) throw new Error(`Step ${spec.id}: no stretch ${spec.stretch}`);
    const composition = { session: 0, login: 0, unassigned: 0 };
    for (const g of clock.segments) composition[g.kind] += overlap(g, start, end);
    return {
      spec,
      index,
      stretch,
      start,
      end,
      took: end - start,
      planned: Math.round(rows.reduce((s, r) => s + r.expected + r.scenario.reduce((x, c) => x + c.ticks, 0), 0) * 10) / 10,
      rows,
      composition,
      levelsFrom: levelsAt(start),
      levelsTo: levelsAt(end),
      nineties: stamps.filter((s) => s.tick > start && s.tick <= end),
      breaks: breaks.filter((b) => b.tick > start && b.tick <= end),
      relogs: relogs.filter((x) => x.tick > start && x.tick <= end),
    };
  });
  const stepAt = (tick: number) => steps.find((s) => tick < s.end) ?? steps.at(-1)!;

  /* How far the hiscore runs ahead of the runner's session clock. */
  const drift: DriftPoint[] = [{ tick: 0, drift: 0 }];
  let ahead = 0;
  for (const g of clock.segments) {
    if (g.from >= finish) break;
    if (g.kind === 'session') continue;
    if (g.to === g.from) continue;
    drift.push({ tick: g.from, drift: ahead });
    ahead += Math.min(g.to, finish) - g.from;
    drift.push({ tick: Math.min(g.to, finish), drift: ahead });
  }
  drift.push({ tick: finish, drift: ahead });
  const sessionClock = (tick: number) =>
    clock.segments.filter((g) => g.kind === 'session').reduce((s, g) => s + overlap(g, 0, tick), 0);
  const stampDrift = stamps.filter((s) => logged.has(s.skill)).map((s) => ({ ...s, drift: s.tick - sessionClock(s.tick) }));

  /* The ledger. */
  const other = a5.final_ticks.other_figures;
  if (!other) throw new Error('The timeline does not keep the swarm’s ledger figures');
  const sessionTicks = log.sessions.reduce((s, x) => s + x.end - x.start, 0);
  const loginTicks = logins.reduce((s, l) => s + l.ticks, 0);
  const unassigned = [...extras.values()].reduce((s, x) => s + x.ticks, 0);
  const swarmLogins = other.observed_client_ledger - sessionTicks;
  const terms: LedgerTerm[] = [
    { id: 'unassigned', ticks: unassigned },
    { id: 'short-logins', ticks: loginTicks - swarmLogins },
    { id: 'after-finish', ticks: finish - clock.end },
  ];
  const closes = other.residual_official_minus_observed - terms.reduce((s, t) => s + t.ticks, 0);
  if (closes !== 0) terms.push({ id: 'residual', ticks: closes });

  return {
    tickMs: log.tickMs,
    finish,
    record: timeline.meta.record.previous_record_ticks,
    planTotal: plan.total.expected,
    sessionTicks,
    segments: clock.segments,
    runAt: clock.runAt,
    stamps,
    steps,
    stretches: STRETCHES,
    breaks,
    relogs,
    logins: [...loginById.values()],
    drift,
    stampDrift,
    ledger: {
      hiscore: finish,
      swarm: other.observed_client_ledger,
      residual: other.residual_official_minus_observed,
      sessions: sessionTicks,
      swarmLogins,
      logins: loginTicks,
      unassigned,
      terms,
    },
    levelsAt,
    stepAt,
  };
}
