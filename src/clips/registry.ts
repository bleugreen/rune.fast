import raw from '../../data/clips.json';
import { fmtPacificClockRange, fmtPacificDayMonYear, pacificZone, parseUtc } from '../lib/time';

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
  /** When the footage was recorded, first and last frame, in UTC as the recording stamps it. */
  recorded: readonly [string, string];
  /** Footage from the lab rather than the run. */
  lab?: boolean;
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

/**
 * When a clip was recorded, as its caption prints it: 'Lab, 23 Oct 2026, 2:50:03–2:50:16 PM'.
 * With `zone`, the Pacific zone follows, for the one clip that names its page's zone.
 */
export function clipWhen(c: ClipEntry, zone = false): string {
  const [a, b] = c.recorded.map(parseUtc) as [number, number];
  const when = `${fmtPacificDayMonYear(a)}, ${fmtPacificClockRange(a, b, true)}${zone ? ` ${pacificZone(a)}` : ''}`;
  return c.lab ? `Lab, ${when}` : when;
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
