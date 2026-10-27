/**
 * Cuts clips from the run host's screen recording of attempt 5 (25 Oct 06:42 to 26 Oct 11:12 UTC). The
 * recording is private and stays on the operator's Mac; what leaves it is the game canvas only (RUNE
 * tenet #4: never the window title, the OS login box, the tray or the SDK panel), encoded like every
 * clip. Each cut is hashed into the local mirror by publish-videos --add, and its poster written to
 * public/clips/. It prints each cut's entry facts for data/clips.json.
 *
 *   bun scripts/world/cut-recording.ts --recording <run-20261025T064222Z.mkv> [--dir .world] [--only <id>]
 *
 * The finish clips (finish-*) were cut before this table existed and are not re-cut by it.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

/**
 * The recording runs 4.0 s behind the time in its file name, with no drift over its 28 hours (the tray
 * clock's minute flips, the SDK log stamps, and frame-matched cuts all agree): a frame's UTC is this
 * instant plus the frame's offset into the file.
 */
const ZERO_MS = Date.parse('2026-10-25T06:42:26Z');
const FPS = 30;
/** The game client's canvas inside the 1920x1080 screen: viewport, sidebar and chatbox. */
const CANVAS = 'crop=1380:904:265:55';
const x264 = (crf = 22) => ['-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];
/** Frames of the dip to black on each side of a cut-out span, so the reader sees where time was taken out. */
const DIP_FRAMES = 9;

interface Cut {
  id: string;
  /** UTC of the first frame and of the end of the window. */
  from: string;
  to: string;
  /** UTC of the frame the poster shows. */
  poster: string;
  /** A region of the canvas the poster shows instead of the whole, scaled to the clip's frame (an ffmpeg filter). */
  posterDetail?: string;
  /** A span (UTC, from inclusive, to exclusive) cut out of the window, marked by a dip to black. */
  skip?: readonly [string, string];
  /** x264's quality, where 22 would take the file over the registry's 3 MB. */
  crf?: number;
}

const CUTS: readonly Cut[] = [
  {
    // Cooking 60 from the first firing, a relog, then Cooking 99.
    id: 'wine-relog',
    from: '2026-10-25T20:26:01.500Z',
    to: '2026-10-25T20:26:16.500Z',
    poster: '2026-10-25T20:26:15.000Z',
    // The game's login form, which shows the account name and the password's length in asterisks, is on
    // screen from 20:26:06.067 to 20:26:06.667 (file frames 1482602 to 1482620). The skip drops two frames
    // of the title screen before it and the first frame of 'Loading' after it.
    skip: ['2026-10-25T20:26:06.000Z', '2026-10-25T20:26:06.733Z'],
  },
  {
    // The courier's trade, the knights' stuns, Charge, and Superheat's first Smithing levels.
    id: 'stun-pack',
    from: '2026-10-25T09:18:44.000Z',
    to: '2026-10-25T09:18:59.000Z',
    poster: '2026-10-25T09:18:48.500Z',
    // A crowd of knights and level-up pages: at 22 the cut is 3.35 MB.
    crf: 23,
  },
  {
    // Charge cast between stuns; Magic 85 to 90.
    id: 'charge-stuns',
    from: '2026-10-25T09:19:01.000Z',
    to: '2026-10-25T09:19:15.500Z',
    poster: '2026-10-25T09:19:13.000Z',
  },
  {
    // Elvarg's fight ends, the Strength 99 page stays open, and the client logs out.
    id: 'dragon-slayer-stop',
    from: '2026-10-25T20:35:39.500Z',
    to: '2026-10-25T20:35:54.500Z',
    poster: '2026-10-25T20:35:47.000Z',
  },
  {
    // Among the spiders with no prayer, antipoison drunk, back south, logged out at 21:34:55.0.
    id: 'spider-stop',
    from: '2026-10-25T21:34:41.000Z',
    to: '2026-10-25T21:34:56.000Z',
    poster: '2026-10-25T21:34:42.000Z',
  },
];

const { values: args } = parseArgs({
  options: {
    recording: { type: 'string' },
    dir: { type: 'string', default: '.world' },
    only: { type: 'string' },
  },
});
const recording = args.recording ?? fail('--recording is required');

function fail(message: string): never {
  console.error(`cut-recording: ${message}`);
  process.exit(1);
}

function run(cmd: string[]): string {
  const r = Bun.spawnSync(cmd, { stderr: 'pipe' });
  if (r.exitCode !== 0) fail(`${cmd[0]} failed: ${r.stderr.toString().trim()}`);
  return r.stdout.toString().trim();
}

const ff = (...a: string[]) => run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', ...a]);
/** Seconds into the file, to the millisecond: offsets of whole frames stay whole frames. */
const offset = (utc: string) => ((Date.parse(utc) - ZERO_MS) / 1000).toFixed(3);
const frames = (from: string, to: string) => Math.round(((Date.parse(to) - Date.parse(from)) / 1000) * FPS);

const work = mkdtempSync(join(tmpdir(), 'cut-recording-'));

for (const c of CUTS) {
  if (args.only && args.only !== c.id) continue;
  const cut = join(work, `${c.id}.mp4`);
  const input = ['-ss', offset(c.from), '-t', ((Date.parse(c.to) - Date.parse(c.from)) / 1000).toFixed(3), '-i', recording];
  if (c.skip) {
    const a = frames(c.from, c.skip[0]);
    const b = frames(c.from, c.skip[1]);
    const graph =
      `[0:v]${CANVAS},split[x][y];` +
      `[x]trim=end_frame=${a},setpts=PTS-STARTPTS,fade=t=out:start_frame=${a - DIP_FRAMES}:nb_frames=${DIP_FRAMES}[p];` +
      `[y]trim=start_frame=${b},setpts=PTS-STARTPTS,fade=t=in:start_frame=0:nb_frames=${DIP_FRAMES}[q];` +
      `[p][q]concat=n=2:v=1:a=0[v]`;
    ff(...input, '-filter_complex', graph, '-map', '[v]', ...x264(c.crf), cut);
  } else {
    ff(...input, '-vf', CANVAS, ...x264(c.crf), cut);
  }
  const still = c.posterDetail ? `${CANVAS},${c.posterDetail}` : CANVAS;
  ff('-ss', offset(c.poster), '-i', recording, '-frames:v', '1', '-vf', still, '-q:v', '3', `public/clips/${c.id}.jpg`);
  const added = JSON.parse(run(['bun', 'scripts/world/publish-videos.ts', '--add', c.id, cut, `--dir=${args.dir}`])) as Record<string, unknown>;
  console.log(JSON.stringify({ ...added, recorded: [c.from, c.to], skip: c.skip }));
}
