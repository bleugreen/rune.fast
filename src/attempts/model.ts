import type { Attempt, EventType, Timeline, TimelineEvent } from '../data/types';
import { HOUR, parseUtc } from '../lib/time';

/* ------------------------------------------------------------------------- */
/* References into the timeline                                              */
/* ------------------------------------------------------------------------- */

type TextField = 'title' | 'detail' | 'cause_verbatim' | 'offline_note';

/**
 * A point in time taken from the JSON: an attempt's start or end bound, an event
 * (keyed by its stored UTC), or a clock time an event's text states (e.g. a title
 * that says 'session 2 13:03:39Z'), read on that event's UTC date. Every ref is
 * checked against the data when resolved, so a ref the JSON does not support
 * fails loudly instead of drawing.
 */
export type Ref = { bound: 'start' | 'end'; says?: string } | { event: string; says?: string; field?: TextField };

const start: Ref = { bound: 'start' };
const end: Ref = { bound: 'end' };
const ev = (utc: string): Ref => ({ event: utc });
const said = (utc: string, says: string, field: TextField = 'title'): Ref => ({ event: utc, says, field });
const endSays = (says: string): Ref => ({ bound: 'end', says });

interface Resolved {
  t: number;
  event: TimelineEvent | null;
}

function statedTime(onDayOf: string, text: string | undefined, says: string, where: string): number {
  if (!text?.includes(says)) throw new Error(`${where} does not state ${says}`);
  return parseUtc(`${onDayOf.slice(0, onDayOf.indexOf('T'))}T${says}Z`);
}

export function resolveRef(a: Attempt, ref: Ref): Resolved {
  if ('bound' in ref) {
    const b = a[ref.bound];
    if (!ref.says) return { t: parseUtc(b.utc), event: null };
    return { t: statedTime(b.utc, b.evidence, ref.says, `${a.id} ${ref.bound} evidence`), event: null };
  }
  const e = a.events.find((x) => x.utc === ref.event);
  if (!e) throw new Error(`${a.id} has no event at ${ref.event}`);
  if (!ref.says) return { t: parseUtc(e.utc), event: e };
  const field = ref.field ?? 'title';
  return { t: statedTime(e.utc, e[field], ref.says, `${a.id} ${e.utc} ${field}`), event: e };
}

/* ------------------------------------------------------------------------- */
/* When each scored account was in the world                                 */
/* ------------------------------------------------------------------------- */

/** A logged-in interval; without `to` it is a one-off login too short to measure at chart scale. */
interface SpanSpec {
  from: Ref;
  to?: Ref;
  /** A stop inside this span that the JSON records in an event of another type. */
  stop?: Ref;
}
const span = (from: Ref, to: Ref, stop?: Ref): SpanSpec => ({ from, to, ...(stop ? { stop } : {}) });
const oneOff = (at: Ref): SpanSpec => ({ from: at });

/**
 * Logged-in spans per scored attempt, each bound pointing at the event that
 * records it. Everything between spans is logged-out time, which is free on
 * the record. The rehearsal and the lab run are drawn as extents only: their
 * log-ins were not recorded at this grain.
 */
export const LOGINS: Readonly<Record<string, readonly SpanSpec[]>> = {
  A1: [span(start, ev('2026-10-23T17:46:31.2Z'))],
  A2: [
    span(start, ev('2026-10-23T19:29:26.76Z')),
    oneOff(ev('2026-10-23T19:41:54.8Z')),
    span(ev('2026-10-23T19:43:44.7Z'), end),
  ],
  A3: [
    span(start, ev('2026-10-23T21:44:22Z')),
    span(ev('2026-10-23T23:10:17.05Z'), ev('2026-10-23T23:16:22Z')),
  ],
  A4: [
    span(start, ev('2026-10-24T12:49:08Z')),
    // The axe one-off that stranded the body in the world, stated in the tab-reset event.
    span(said('2026-10-24T12:49:08Z', '12:54:42', 'detail'), said('2026-10-24T12:49:08Z', '12:59:40', 'detail')),
    oneOff(said('2026-10-24T12:49:08Z', '12:59:50', 'detail')),
    span(said('2026-10-24T12:49:08Z', '13:03:39'), ev('2026-10-24T13:53:07Z')),
    span(said('2026-10-24T13:53:07Z', '13:55:05'), ev('2026-10-24T14:06:32Z')),
    oneOff(ev('2026-10-24T14:18:40Z')),
    oneOff(said('2026-10-24T14:18:40Z', '14:21:49')),
    span(ev('2026-10-24T14:22:13Z'), endSays('14:26:16.4')),
    oneOff(ev('2026-10-24T14:32:42Z')),
  ],
  A5: [
    span(ev('2026-10-25T06:56:33Z'), ev('2026-10-25T07:33:09.659Z')),
    span(ev('2026-10-25T07:40:21Z'), ev('2026-10-25T08:12:47.592Z')),
    span(ev('2026-10-25T08:19:08Z'), ev('2026-10-25T09:06:10Z')),
    oneOff(ev('2026-10-25T09:11:53Z')),
    span(said('2026-10-25T09:11:53Z', '09:14:19'), ev('2026-10-25T09:33:29.668Z')),
    oneOff(ev('2026-10-25T18:11:57Z')),
    oneOff(ev('2026-10-25T18:35:15Z')),
    span(ev('2026-10-25T18:41:39.849Z'), ev('2026-10-25T18:52:06Z')),
    span(ev('2026-10-25T19:35:31Z'), said('2026-10-25T19:46:27.851Z', '19:46:31.435')),
    span(said('2026-10-25T19:46:27.851Z', '19:55:36.360'), ev('2026-10-25T20:35:45.809Z')),
    span(ev('2026-10-25T20:40:04.783Z'), ev('2026-10-25T20:41:10.163Z')),
    span(ev('2026-10-25T21:33:25.731Z'), said('2026-10-25T21:34:39.948Z', '21:34:55.237')),
    // The prayer-return one-off is typed a recovery; its text records the stop at t23.
    span(
      ev('2026-10-26T03:25:55.176Z'),
      said('2026-10-26T03:25:55.176Z', '03:26:05.989'),
      said('2026-10-26T03:25:55.176Z', '03:26:03.102', 'cause_verbatim'),
    ),
    // The return-only one-off: its logout was refused, and the body stayed until the death.
    span(ev('2026-10-26T03:36:26.963Z'), said('2026-10-26T03:40:37Z', '03:40:43')),
    span(ev('2026-10-26T10:27:08.417Z'), ev('2026-10-26T11:07:53.355Z')),
  ],
};

/** Chart rows, top to bottom. The rehearsal shares its account's row. */
export const ROWS: ReadonlyArray<readonly string[]> = [['A1'], ['A2'], ['A3', 'R3'], ['A4'], ['L2'], ['A5']];

/** The time axis of the timeline chart, before a figure crops it. */
export const DOMAIN = ['2026-10-23T17:00Z', '2026-10-26T12:00Z'] as const;

/** Logged-out gaps at least this long carry their duration on the chart. */
export const HOLD_LABEL_MIN = HOUR;

/* ------------------------------------------------------------------------- */
/* Derived model                                                             */
/* ------------------------------------------------------------------------- */

export interface Span {
  from: number;
  to: number | null;
}

export interface Gap {
  from: number;
  to: number;
}

export interface Mark {
  key: string;
  attemptId: string;
  event: TimelineEvent;
  /** Where the mark sits; for a stop recorded inside another event, the stated stop time. */
  t: number;
  kind: EventType;
  /** Whether the account was logged in at t; null where log-ins are not modelled. */
  inWorld: boolean | null;
}

export interface AttemptModel {
  attempt: Attempt;
  shortName: string;
  scored: boolean;
  start: number;
  end: number;
  spans: Span[] | null;
  /** Extent of the attempt's line on the chart: first log-in or start, to last log-out or end. */
  line: [number, number];
  holds: Gap[];
  marks: Mark[];
}

export const isScored = (a: Attempt) => a.kind === 'scored attempt';

export function modelAttempt(a: Attempt): AttemptModel {
  const startT = parseUtc(a.start.utc);
  const endT = parseUtc(a.end.utc);
  const specs = LOGINS[a.id];
  const spans: Span[] | null = specs
    ? specs.map((s) => ({ from: resolveRef(a, s.from).t, to: s.to ? resolveRef(a, s.to).t : null }))
    : null;
  const inWorld = (t: number) => (spans ? spans.some((s) => t >= s.from && t <= (s.to ?? s.from)) : null);

  const marks: Mark[] = a.events.map((e, i) => {
    const t = parseUtc(e.utc);
    return { key: `${a.id}/${i}`, attemptId: a.id, event: e, t, kind: e.type, inWorld: inWorld(t) };
  });
  specs?.forEach((s, i) => {
    if (!s.stop) return;
    const r = resolveRef(a, s.stop);
    if (!r.event) throw new Error(`${a.id}: a stop must point at an event`);
    marks.push({ key: `${a.id}/stop-in-span-${i}`, attemptId: a.id, event: r.event, t: r.t, kind: 'stop', inWorld: inWorld(r.t) });
  });
  marks.sort((x, y) => x.t - y.t);

  const measured = (spans ?? []).filter((s): s is { from: number; to: number } => s.to !== null);
  const holds = measured
    .slice(1)
    .map((s, i) => ({ from: measured[i]!.to, to: s.from }))
    .filter((g) => g.to - g.from >= HOLD_LABEL_MIN);

  const ends = (spans ?? []).map((s) => s.to ?? s.from);
  return {
    attempt: a,
    shortName: a.name.split(' (')[0]!,
    scored: isScored(a),
    start: startT,
    end: endT,
    spans,
    line: [Math.min(startT, spans?.[0]?.from ?? startT), Math.max(endT, ...ends)],
    holds,
    marks,
  };
}

/**
 * The marks the chart draws: deaths, and stops while the account was in the world (a refused
 * resume or a helper failure is not one). Every other event stays off the chart; the finish is
 * drawn as its tick count.
 */
export const drawnMarks = (am: AttemptModel) =>
  am.marks.filter((m) => m.kind === 'death' || (m.kind === 'stop' && m.inWorld !== false));

export interface ChartModel {
  domain: [number, number];
  rows: AttemptModel[][];
  byId: Map<string, AttemptModel>;
  scored: AttemptModel[];
  last: AttemptModel;
}

export function buildChartModel(t: Timeline): ChartModel {
  const byId = new Map(t.attempts.map((a) => [a.id, modelAttempt(a)]));
  const rows = ROWS.map((ids) =>
    ids.map((id) => {
      const am = byId.get(id);
      if (!am) throw new Error(`Row names ${id}, which the timeline does not have`);
      return am;
    }),
  );
  const scored = [...byId.values()].filter((am) => am.scored).sort((a, b) => a.start - b.start);
  const last = scored.at(-1);
  if (!last) throw new Error('No scored attempts');
  return { domain: [parseUtc(DOMAIN[0]), parseUtc(DOMAIN[1])], rows, byId, scored, last };
}

/* ------------------------------------------------------------------------- */
/* The record                                                                */
/* ------------------------------------------------------------------------- */

export interface RecordFacts {
  previous: number;
  final: number;
  margin: number;
  /** Milliseconds per tick of the official, normalized score. */
  tickMs: number;
}

export function recordFacts(t: Timeline): RecordFacts {
  const { previous_record_ticks: previous, final_ticks: final } = t.meta.record;
  const ms = /normalized to (\d+) ms/.exec(t.meta.tick_units);
  if (!ms) throw new Error('tick_units does not state the normalized tick length');
  return { previous, final, margin: previous - final, tickMs: Number(ms[1]) };
}

export interface HeadlineFacts {
  scoredCount: number;
  /** Whole hours from the first scored start to the last scored end. */
  hours: number;
  lastStops: number;
  lastDeaths: number;
}

export function headlineFacts(model: ChartModel): HeadlineFacts {
  const first = model.scored[0]!;
  return {
    scoredCount: model.scored.length,
    hours: Math.floor((model.last.end - first.start) / HOUR),
    lastStops: stopsInWorld(model.last).length,
    lastDeaths: deaths(model.last).length,
  };
}

