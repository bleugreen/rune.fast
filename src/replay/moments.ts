import momentsJson from '../../data/replay-moments.json';
import stepsJson from '../../data/finish-steps.json';
import { timeline } from '../data/timeline';
import type { TimelineEvent } from '../data/types';
import { WORLD_ASSET_BASE } from './assets';

/** The recovery run's steps by session tick, with the code each ran (scripts/world/import-steps.ts). */
export type RunStep = {
  id: string;
  name: string;
  plain: string;
  from: number;
  to: number;
  code: { module: string; symbol: string; startLine: number; code: string } | null;
  codeNote?: string;
};

export const STEPS = stepsJson.steps as RunStep[];
export const STEP_SOURCE = stepsJson.source;

/** A point on a moment's scrubber. */
export type ReplayMark = { sessionTick: number; label: string; event?: TimelineEvent };

/** A tick window of the finish recording, opened at its first tick with the camera on the record account. */
export type Moment = {
  id: string;
  title: string;
  caption: string;
  /** Session ticks, inclusive. */
  from: number;
  to: number;
  marks: ReplayMark[];
};

/** Where the finish clip's manifest and chunks are served, ending in a slash. */
export const FINISH_BASE = `${WORLD_ASSET_BASE}replays/finish/`;

function eventAt(utc: string): TimelineEvent {
  const event = timeline.attempts.flatMap((a) => a.events).find((e) => e.utc === utc);
  if (!event) throw new Error(`No timeline event at ${utc}`);
  return event;
}

const recovery = eventAt('2026-10-26T10:27:08.417Z');
const result = eventAt('2026-10-26T11:07:53.355Z');
const agilityTick = Number(/Agility 99 at tick ([\d,]+)/.exec(result.title)?.[1]?.replace(/,/g, ''));

/** The whole recovery's marks, each the timeline event that dates it. */
const TIMELINE_MARKS: ReplayMark[] = [
  // Session tick 1 is the first tick the account is in the world after the recovery launch.
  { sessionTick: 1, label: 'Login', event: recovery },
  { sessionTick: agilityTick, label: 'Agility 99', event: result },
];

/** The step running at a session tick: the last one started by then (none before the first). */
export function stepAt(tick: number): RunStep | undefined {
  let found: RunStep | undefined;
  for (const s of STEPS) if (s.from <= tick) found = s;
  return found;
}

/** The steps a window shows. */
export function stepsIn(from: number, to: number): RunStep[] {
  return STEPS.filter((s) => s.to >= from && s.from <= to);
}

type MomentEntry = { id: string; title: string; caption: string; from: number; to: number; marks?: 'timeline' };

export const MOMENTS: Moment[] = (momentsJson as MomentEntry[]).map((m) => ({
  ...m,
  // A short moment marks where each step starts; the whole recovery marks the timeline's events.
  marks:
    m.marks === 'timeline'
      ? TIMELINE_MARKS
      : stepsIn(m.from, m.to)
          .filter((s) => s.from > m.from && s.from <= m.to)
          .map((s) => ({ sessionTick: s.from, label: s.id })),
}));

export function momentById(id: string | undefined): Moment | undefined {
  return MOMENTS.find((m) => m.id === id);
}
