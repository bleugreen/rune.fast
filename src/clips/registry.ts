import raw from '../../data/clips.json';
import { fmtPacificClockRange, fmtPacificDayMonYear, pacificZone, parseUtc } from '../lib/time';
import { WORLD_ASSET_BASE } from '../replay/assets';

/** Where footage comes from, as its caption names it. */
export type SourceLabel = 'run feed' | 'finish recording' | 'lab film';

export interface ClipSource {
  /**
   * run feed: the swarm's recording of the demo server's world feed, replayed in 3D.
   * finish recording: the run host's screen recording of attempt 5.
   * lab film: a capture made in the lab, from the rs-sdk fork at `commit`.
   */
  label: SourceLabel;
  /** The rs-sdk commit a lab film was made from. */
  commit?: string;
  /** How the footage was cut and timed, in plain words. */
  note: string;
}

/** What a caption line prints besides what is on screen: when, and from where. */
export interface Provenance {
  /** When it was recorded, first and last frame, in UTC as the recording stamps it; the caption prints Pacific. */
  recorded: readonly [string, string];
  source: ClipSource;
}

interface Footage extends Provenance {
  id: string;
  /** Under public/, as the page requests it: the still the frame shows at rest. */
  poster: string;
  /** The frame's size in pixels; the frame keeps this aspect at any width. */
  width: number;
  height: number;
  seconds: number;
  /** What is on screen. */
  caption: string;
  /** The run step it shows, in plain words. */
  step: string;
}

/** A short silent video file. */
export interface VideoEntry extends Footage {
  kind: 'video';
  /**
   * Its key under the world assets, clips/<id>.<sha8>.mp4, the name carrying the content: R2 in
   * production, .world/ in dev and preview (scripts/world/publish-videos.ts). Never in git.
   */
  src: string;
  /** The file's size, which the bucket must answer with. */
  bytes: number;
  /** A lab clip's trace, the file its tick map was read from. */
  trace?: string;
  /** A lab clip's tick map: [ms into the clip, the server tick from that ms on], ascending, the first at 0. */
  ticks?: readonly (readonly [number, number])[];
}

/**
 * A tick window of a published world-feed recording, drawn in 3D following the account its manifest
 * names: the record account, or another run account by its slot alias, unnamed.
 */
export interface ReplayEntry extends Footage {
  kind: 'replay';
  /** The recording's folder under replays/ in the world assets, where its manifest and chunks are. */
  recording: string;
  /**
   * Ticks of the recording, inclusive, counted from its manifest's anchor: for the finish, the
   * scored session's own count; for the death recordings (anchor 0), the feed's ticks.
   */
  from: number;
  to: number;
}

/** One piece of footage, as data/clips.json registers it. */
export type ClipEntry = VideoEntry | ReplayEntry;

/** A server tick in milliseconds, on the server the run played on (129 ticks were 51.6 seconds). */
export const TICK_MS = 400;

export const CLIPS = raw as unknown as readonly ClipEntry[];

const byId = new Map(CLIPS.map((c) => [c.id, c]));

export function clipById(id: string): ClipEntry {
  const c = byId.get(id);
  if (!c) throw new Error(`No clip '${id}' in data/clips.json`);
  return c;
}

/**
 * When the footage was recorded, Pacific, as its caption prints it: '26 Oct 2026, 3:27:15–3:27:27 AM'.
 * With `zone`, the Pacific zone follows, for the one clip that names its page's zone.
 */
export function clipWhen(c: Pick<Provenance, 'recorded'>, zone = false): string {
  const [a, b] = c.recorded.map(parseUtc) as [number, number];
  return `${fmtPacificDayMonYear(a)}, ${fmtPacificClockRange(a, b, true)}${zone ? ` ${pacificZone(a)}` : ''}`;
}

/** The caption's source: 'Finish recording', 'Run feed', or 'Lab film, rs-sdk 3546291'. */
export function clipSource(c: Pick<Provenance, 'source'>): string {
  const { label, commit } = c.source;
  const name = label.charAt(0).toUpperCase() + label.slice(1);
  return commit ? `${name}, rs-sdk ${commit.slice(0, 7)}` : name;
}

/** Where the page fetches a video: its key under the world assets. */
export function clipSrc(v: VideoEntry): string {
  return `${WORLD_ASSET_BASE}${v.src}`;
}

/** The server tick on screen at this point of the clip: the last tick that began at or before it. */
export function tickAt(ticks: NonNullable<VideoEntry['ticks']>, ms: number): number {
  let lo = 0;
  let hi = ticks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ticks[mid]![0] <= ms) lo = mid;
    else hi = mid - 1;
  }
  return ticks[lo]![1];
}

/** The tick the caption counts at this point of the clip: a lab clip's server tick, a replay's session tick. */
export function clipTickAt(c: ClipEntry, ms: number): number | undefined {
  if (c.kind === 'replay') return Math.min(c.from + Math.floor(ms / TICK_MS), c.to);
  return c.ticks && tickAt(c.ticks, ms);
}
