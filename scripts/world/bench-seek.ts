/**
 * Measures backward seek cost on an hour of recording, with real cache loaders.
 *
 *   bun scripts/world/bench-seek.ts --recordings <recorder>/out [--from 2026-10-26T10:00:00Z] \
 *     [--to 2026-10-26T11:00:00Z] [--seeks 20] [--every 50]
 *
 * The segment is built like a clip (simulated from the last hello to --from, then held in memory;
 * nothing is written). From the segment's end it seeks back to the same random ticks two ways:
 * (a) restore the segment-start checkpoint and play forward, (b) restore the nearest checkpoint
 * taken every --every ticks and play forward. Reports median and p95 for each, and what the
 * checkpoints weigh as JSON.
 */
import { parseArgs } from 'node:util';
import type { Checkpoint, ReplayFrame } from '@rune/world/replay/clip';
import { ArrayFrameSource, Playhead } from '@rune/world/replay/Playhead';
import { StreamSource, headlessController, openChain, recordedFrames } from './recordings';

const { values: args } = parseArgs({
  options: {
    recordings: { type: 'string' },
    cache: { type: 'string', default: '.world/cache' },
    from: { type: 'string', default: '2026-10-26T10:00:00Z' },
    to: { type: 'string', default: '2026-10-26T11:00:00Z' },
    seeks: { type: 'string', default: '20' },
    every: { type: 'string', default: '50' },
  },
});
if (!args.recordings) throw new Error('--recordings is required');
const fromMs = Date.parse(args.from);
const toMs = Date.parse(args.to);
const every = Number(args.every);

const { controller, handlers } = headlessController(args.cache);
const world = controller.world;
const chain = openChain(args.recordings, fromMs, toMs);
const stream = new StreamSource(recordedFrames(chain, toMs));
const baseline = new Playhead(world, handlers, stream);

let t = performance.now();
for (;;) {
  const next = stream.peek();
  if (!next || next.recv >= fromMs) break;
  baseline.step();
}
console.log(`baseline to ${args.from}: ${((performance.now() - t) / 1000).toFixed(1)} s`);

// The segment in memory, as frames indexed from the segment start.
const start: Checkpoint = JSON.parse(JSON.stringify(baseline.checkpoint()));
const offset = stream.position;
const frames: ReplayFrame[] = [];
for (let f = stream.peek(); f; f = stream.peek()) {
  frames.push(f);
  stream.advance();
}
const source = new ArrayFrameSource(frames, offset);
const playhead = new Playhead(world, handlers, source);
playhead.restore(start);

// Play the hour once, taking a checkpoint every `every` ticks (as the browser does while playing).
const checkpoints: Checkpoint[] = [start];
let bytes = JSON.stringify(start).length;
let next = (Math.floor(world.tick / every) + 1) * every;
t = performance.now();
let cycles = 0;
while (playhead.step() !== 'end') {
  cycles++;
  if (world.tick >= next) {
    next = (Math.floor(world.tick / every) + 1) * every;
    const cp = playhead.checkpoint();
    bytes += JSON.stringify(cp).length;
    checkpoints.push(cp);
  }
}
const playMs = performance.now() - t;
const ticks = frames.filter((f) => f.msg.t === 'tick').length;
console.log(
  `segment: ${frames.length} frames, ${ticks} ticks, ${cycles} cycles played in ${(playMs / 1000).toFixed(1)} s ` +
    `(${((playMs * 1000) / cycles).toFixed(1)} us per cycle, checkpoints included)`,
);
console.log(
  `checkpoints: ${checkpoints.length} (every ${every} ticks), ${(bytes / 1e6).toFixed(1)} MB as JSON, ` +
    `${(bytes / checkpoints.length / 1e3).toFixed(0)} kB each`,
);

// Seek targets: random ticks in the segment, the same for both methods.
const tickIndexes = frames.flatMap((f, i) => (f.msg.t === 'tick' ? [i + offset] : []));
let seed = 289;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const targets = Array.from({ length: Number(args.seeks) }, () => tickIndexes[Math.floor(rand() * tickIndexes.length)]!);

function seek(target: number, base: Checkpoint): number {
  const t0 = performance.now();
  playhead.restore(base);
  while (source.position <= target && playhead.step() !== 'end');
  return performance.now() - t0;
}

const end = playhead.checkpoint();
const a: number[] = [];
const b: number[] = [];
for (const target of targets) {
  playhead.restore(end);
  a.push(seek(target, start));
  playhead.restore(end);
  const nearest = checkpoints.filter((c) => c.frameIndex <= target).at(-1)!;
  b.push(seek(target, nearest));
}

const stat = (xs: number[]) => {
  const s = [...xs].sort((x, y) => x - y);
  const q = (p: number) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]!;
  return `median ${q(0.5).toFixed(0)} ms, p95 ${q(0.95).toFixed(0)} ms, max ${s[s.length - 1]!.toFixed(0)} ms`;
};
console.log(`(a) from the segment start: ${stat(a)}`);
console.log(`(b) from the nearest ${every}-tick checkpoint: ${stat(b)}`);
