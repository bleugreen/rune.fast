/**
 * The recorder's hourly world-feed files as one gated frame stream, and a headless live layer on
 * the real cache to play it into. Shared by publish-clip and bench-seek. Errors name files and
 * line numbers, never payloads.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INITIAL_GATE, gateFrame, type FeedGateState } from '@rune/world/live/FeedGate';
import type { FeedHandlers } from '@rune/world/live/FeedSource';
import { LiveController } from '@rune/world/live/LiveController';
import { parseFeedFrame, type FeedMessage } from '@rune/world/live/protocol';
import type { ReplayFrame } from '@rune/world/replay/clip';
import type { FrameSource } from '@rune/world/replay/Playhead';
import { loadCacheFromDir } from '@rune/world/node/cacheFromDir';

const REVISION = 289;
const FILE = /^feed-(\d{4})(\d{2})(\d{2})(\d{2})Z\.jsonl$/;

export class RecordingError extends Error {}

export type Sub = { recv: number; x: number; z: number; w: number; h: number };

export type Chain = {
  dir: string;
  files: string[];
  // The hello the chain starts from: line index in files[0], and its recv.
  helloLine: number;
  helloRecv: number;
};

/** The hourly files from the one holding the last hello before `fromMs` through the one holding `toMs`. */
export function openChain(dir: string, fromMs: number, toMs: number): Chain {
  const hourly = readdirSync(dir)
    .map((name) => {
      const m = FILE.exec(name);
      return m ? { name, hour: Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!) } : undefined;
    })
    .filter((f): f is { name: string; hour: number } => !!f)
    .sort((a, b) => a.hour - b.hour);
  for (let i = hourly.findLastIndex((f) => f.hour <= fromMs); i >= 0; i--) {
    const lines = readFileSync(join(dir, hourly[i]!.name), 'utf8').split('\n');
    for (let l = lines.length - 1; l >= 0; l--) {
      const line = lines[l]!;
      if (!line.includes('"t":"hello"')) continue;
      const recv = (JSON.parse(line) as { recv: number }).recv;
      if (recv >= fromMs) continue;
      const last = hourly.findLastIndex((f) => f.hour <= toMs);
      return { dir, files: hourly.slice(i, last + 1).map((f) => f.name), helloLine: l, helloRecv: recv };
    }
  }
  throw new RecordingError('no hello precedes the start of the window in the recordings');
}

export type StreamStats = { lines: number; dropped: number };

/**
 * Every frame of the chain up to `toMs`, parsed and gated as the live socket would have, in
 * order. `sent` subscription lines go to onSub. Checks that recv never goes backwards and that
 * every file ends in a newline.
 */
export function* recordedFrames(
  chain: Chain,
  toMs: number,
  onSub: (sub: Sub) => void = () => {},
  stats: StreamStats = { lines: 0, dropped: 0 },
): Generator<ReplayFrame> {
  let gate: FeedGateState = INITIAL_GATE;
  let lastRecv = -Infinity;
  for (const [i, name] of chain.files.entries()) {
    const text = readFileSync(join(chain.dir, name), 'utf8');
    if (!text.endsWith('\n')) throw new RecordingError(`${name} does not end in a newline (truncated?)`);
    let pos = 0;
    if (i === 0) for (let l = 0; l < chain.helloLine; l++) pos = text.indexOf('\n', pos) + 1;
    while (pos < text.length) {
      const end = text.indexOf('\n', pos);
      const line = text.slice(pos, end);
      pos = end + 1;
      if (!line) continue;
      stats.lines++;
      const lead = /^\{"recv":(\d+),/.exec(line);
      if (!lead) throw new RecordingError(`${name}: a line has no leading recv`);
      const recv = Number(lead[1]);
      if (recv < lastRecv) throw new RecordingError(`${name}: recv goes backwards at line ${stats.lines}`);
      lastRecv = recv;
      if (recv > toMs) return;
      const frameAt = line.indexOf(',"frame":');
      if (frameAt === -1) {
        const sent = (JSON.parse(line) as { sent?: Partial<Sub> & { t?: string } }).sent;
        if (sent?.t === 'sub') onSub({ recv, x: sent.x!, z: sent.z!, w: sent.w!, h: sent.h! });
        continue;
      }
      let msg: FeedMessage;
      try {
        // The recorder writes {"recv":N,"frame":<the frame exactly as received>}.
        msg = parseFeedFrame(line.slice(frameAt + 9, -1), REVISION);
      } catch (e) {
        throw new RecordingError(`${name}: invalid frame at line ${stats.lines}: ${(e as Error).message}`);
      }
      const r = gateFrame(gate, msg);
      gate = r.state;
      if (r.verdict === 'drop') {
        stats.dropped++;
        continue;
      }
      yield { recv, msg };
    }
  }
}

/** A FrameSource over a one-pass iterator. */
export class StreamSource implements FrameSource {
  position = 0;
  private head: ReplayFrame | undefined;
  private fetched = false;
  constructor(private readonly it: Iterator<ReplayFrame>) {}
  peek(): ReplayFrame | undefined {
    if (!this.fetched) {
      const n = this.it.next();
      this.head = n.done ? undefined : n.value;
      this.fetched = true;
    }
    return this.head;
  }
  advance(): void {
    this.fetched = false;
    this.position++;
  }
  seek(): void {
    throw new Error('a stream cannot seek');
  }
}

/** A live controller on the real cache loaders (checkpoints must carry real animation state). */
export function headlessController(cacheDir: string): { controller: LiveController; handlers: FeedHandlers; cacheName: string; revision: number } {
  const { info, loaderFactory } = loadCacheFromDir(cacheDir);
  let handlers: FeedHandlers | undefined;
  const controller = new LiveController(
    (h) => {
      handlers = h;
      return { connect() {}, close() {}, reconnect() {}, setRoster() {}, setArea() {} };
    },
    loaderFactory.getNpcTypeLoader(),
    loaderFactory.getSeqTypeLoader(),
    loaderFactory.getSeqFrameLoader(),
    loaderFactory.getSpotAnimTypeLoader?.(),
    info.revision,
  );
  return { controller, handlers: handlers!, cacheName: info.name, revision: info.revision };
}
