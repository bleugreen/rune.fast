import raw from '../../data/clips.json';

/** One clip, as data/clips.json registers it. */
export interface ClipEntry {
  id: string;
  /** Under public/, as the page requests it. */
  src: string;
  poster: string;
  /** The encoded frame in pixels; the player keeps this aspect at any width. */
  width: number;
  height: number;
  seconds: number;
  /** What is on screen. */
  caption: string;
  /** When it was recorded: UTC for the run, the lab and its UTC for a lab clip. */
  time: string;
  /** The run step it shows, in plain words. */
  step: string;
  /** Where the footage comes from, in plain words. */
  source: string;
  /** A lab clip's trace, the file its tick map was read from. */
  trace?: string;
  /** A lab clip's tick map: [ms into the clip, the server tick from that ms on], ascending, the first at 0. */
  ticks?: readonly (readonly [number, number])[];
}

export const CLIPS = raw as unknown as readonly ClipEntry[];

const byId = new Map(CLIPS.map((c) => [c.id, c]));

export function clipById(id: string): ClipEntry {
  const c = byId.get(id);
  if (!c) throw new Error(`No clip '${id}' in data/clips.json`);
  return c;
}

/** The server tick on screen at this point of the clip: the last tick that began at or before it. */
export function tickAt(ticks: NonNullable<ClipEntry['ticks']>, ms: number): number {
  let lo = 0;
  let hi = ticks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ticks[mid]![0] <= ms) lo = mid;
    else hi = mid - 1;
  }
  return ticks[lo]![1];
}
