/**
 * Every published replay clip: its window of the recordings, whose camera it follows, how its
 * ticks are numbered, and what the window must be shown to hold before it is published.
 */

export type ClipMark = { k: number; at: string; what: string };

export type ClipConfig = {
  /** UTC instants bounding the clip: the frames received from `from` through `to`. */
  window: { from: string; to: string };
  /**
   * `record`: the record account (RUNE_SCORED_ACCOUNT), named in the manifest.
   * `env`: another run account, named only by RUNE_FOLLOW_ACCOUNT; it is redacted like every
   * other player and the manifest follows it by its slot alias, so the clip names no one.
   */
  follow: 'record' | 'env';
  /**
   * The followed account's roster slot through the window, as measured: a valid but wrong name in
   * the environment would hold some other slot, and fail the publish instead of following it.
   */
  slot: number;
  /** sessionTick = k - kOffset. 0 numbers the clip in the feed's own ticks. */
  kOffset: number;
  ticksPerChunk: number;
  /** Ticks the numbering must hit: each must be received within 100 ms of `at`. */
  marks: ClipMark[];
  /** A death clip's beats: the followed account reaches 0 HP, then is first seen at this respawn tile. */
  death?: { respawn: [number, number] };
};

export const CLIPS: Record<string, ClipConfig> = {
  finish: {
    window: { from: '2026-10-26T10:27:00Z', to: '2026-10-26T11:08:00Z' },
    follow: 'record',
    slot: 1167,
    // Login after the final recovery is session tick 1 at k 118025 (timeline: 10:27:14.715Z).
    kOffset: 118024,
    ticksPerChunk: 150,
    // Agility 99, session tick 6095 on the timeline at 11:07:53.355Z.
    marks: [{ k: 124119, at: '2026-10-26T11:07:53.355Z', what: 'Agility 99' }],
  },
  // 26 Oct: the record account's abandoned body among the poison spiders at the cannon site,
  // killed after its client was. The window holds its last five hit splats (HP 19 to 0), the
  // death and the Lumbridge respawn; the session ends 0.3 s after it.
  'spider-death': {
    window: { from: '2026-10-26T03:40:23.500Z', to: '2026-10-26T03:40:38.500Z' },
    follow: 'record',
    slot: 833,
    kOffset: 0,
    ticksPerChunk: 150,
    // The timeline dates this death by roster sightings to the second, not by tick.
    marks: [],
    death: { respawn: [3222, 3220] },
  },
  // 24 Oct: attempt 4's account, not the record account, poisoned at the Grand Tree door while
  // the runner waited. Poison lands every 12 s, so the window holds one splat (HP 2 to 0).
  'grand-tree-death': {
    window: { from: '2026-10-24T14:23:18.000Z', to: '2026-10-24T14:23:33.000Z' },
    follow: 'env',
    slot: 994,
    kOffset: 0,
    ticksPerChunk: 150,
    // The timeline's death entry dates the jump by feed tick, from the roster.
    marks: [{ k: 216740, at: '2026-10-24T14:23:29.970Z', what: 'the respawn jump' }],
    death: { respawn: [3221, 3220] },
  },
};
