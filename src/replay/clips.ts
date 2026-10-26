import { timeline } from '../data/timeline';
import type { TimelineEvent } from '../data/types';
import { WORLD_ASSET_BASE } from './assets';

/** A point on the replay's timeline, tied to the timeline event that dates it. */
export type ReplayMark = { sessionTick: number; label: string; event: TimelineEvent };

export type ReplayClip = {
  id: string;
  title: string;
  /** Where the manifest and chunks are served, ending in a slash. */
  base: string;
  marks: ReplayMark[];
};

function eventAt(utc: string): TimelineEvent {
  const event = timeline.attempts.flatMap((a) => a.events).find((e) => e.utc === utc);
  if (!event) throw new Error(`No timeline event at ${utc}`);
  return event;
}

const recovery = eventAt('2026-10-26T10:27:08.417Z');
const result = eventAt('2026-10-26T11:07:53.355Z');
const agilityTick = Number(/Agility 99 at tick ([\d,]+)/.exec(result.title)?.[1]?.replace(/,/g, ''));

/** 26 October, 10:27 to 11:08 UTC: the final recovery login through Agility 99. */
export const FINISH: ReplayClip = {
  id: 'finish',
  title: 'The finish, from the recovery login to Agility 99',
  base: `${WORLD_ASSET_BASE}replays/finish/`,
  marks: [
    // Session tick 1 is the first tick the account is in the world after the recovery launch.
    { sessionTick: 1, label: 'Login', event: recovery },
    { sessionTick: agilityTick, label: 'Agility 99', event: result },
  ],
};
