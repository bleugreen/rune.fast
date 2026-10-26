/**
 * Builds a replay clip from the recorder's hourly world-feed files: chains them from the last
 * hello before the window, gates and redacts every frame, simulates headless with the real cache
 * loaders up to the window, then writes one-minute chunks (each led by its checkpoint) and a
 * manifest, and scans every byte it wrote. With --upload it then puts them on R2.
 *
 *   RUNE_SCORED_ACCOUNT="$(cat <recorder>/follow)" bun scripts/world/publish-clip.ts \
 *     --clip finish --from 2026-10-26T10:27:00Z --to 2026-10-26T11:08:00Z \
 *     --recordings <recorder>/out --cache .world/cache [--out .world] [--upload] [--upload-cache]
 *
 * The scored account's name comes only from the environment. Nothing this script prints carries
 * a name or a payload: counts, ticks, slots, sizes and times.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { canonicalAccountName } from '@rune/world/live/accountName';
import type { FeedHandlers } from '@rune/world/live/FeedSource';
import {
  CLIP_VERSION,
  formatCheckpointLine,
  formatFrameLine,
  type ClipChunk,
  type ClipManifest,
  type ReplayFrame,
} from '@rune/world/replay/clip';
import { cutChunks } from '@rune/world/replay/cut';
import { Playhead } from '@rune/world/replay/Playhead';
import { RecordingError, StreamSource, headlessController, openChain, recordedFrames, type StreamStats } from './recordings';
import { RedactionError, Redactor, scanEmitted } from './redact';

/** Per clip: how session ticks are numbered, how long chunks are, and marks the tick numbering must hit. */
const CLIPS: Record<string, { kOffset: number; slot: number; ticksPerChunk: number; marks: { k: number; at: string; what: string }[] }> = {
  finish: {
    // The scored account's roster slot through the window, as measured: a valid but wrong name
    // in RUNE_SCORED_ACCOUNT would hold some other slot, and fail here instead of publishing it.
    slot: 1167,
    // Login after the final recovery is session tick 1 at k 118025 (timeline: 10:27:14.715Z).
    kOffset: 118024,
    ticksPerChunk: 150,
    // Agility 99, session tick 6095 on the timeline at 11:07:53.355Z.
    marks: [{ k: 124119, at: '2026-10-26T11:07:53.355Z', what: 'Agility 99' }],
  },
};
const MARK_TOLERANCE_MS = 100;

function fail(message: string): never {
  console.error(`publish-clip: ${message}`);
  process.exit(1);
}

const { values: args } = parseArgs({
  options: {
    clip: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    recordings: { type: 'string' },
    cache: { type: 'string', default: '.world/cache' },
    // .world mirrors the bucket's world/ prefix: cache/ and replays/.
    out: { type: 'string', default: '.world' },
    upload: { type: 'boolean', default: false },
    'upload-cache': { type: 'boolean', default: false },
  },
});
const clipId = args.clip ?? fail('--clip is required');
const clip = CLIPS[clipId] ?? fail(`unknown clip ${clipId}`);
const fromMs = Date.parse(args.from ?? fail('--from is required'));
const toMs = Date.parse(args.to ?? fail('--to is required'));
if (!(fromMs < toMs)) fail('--from must be before --to');
const recordings = args.recordings ?? fail('--recordings is required');

let redactor: Redactor;
try {
  redactor = new Redactor(process.env.RUNE_SCORED_ACCOUNT);
} catch (e) {
  fail(e instanceof RedactionError ? e.message : 'could not start redaction');
}

// --- Frames: the hourly chain from the last hello before --from, gated, then redacted ---

let chain;
try {
  chain = openChain(recordings, fromMs, toMs);
} catch (e) {
  fail(e instanceof RecordingError ? e.message : 'could not open the recordings');
}
console.log(`chain: ${chain.files.length} hourly files from ${chain.files[0]}, hello at ${new Date(chain.helloRecv).toISOString()}`);

const subs: ClipManifest['subs'] = [];
const stats: StreamStats = { lines: 0, dropped: 0 };
function* frames(): Generator<ReplayFrame> {
  try {
    for (const frame of recordedFrames(chain!, toMs, (sub) => sub.recv >= fromMs && subs.push(sub), stats)) {
      yield { recv: frame.recv, msg: redactor.redact(frame.msg) };
    }
  } catch (e) {
    fail(e instanceof RecordingError ? e.message : 'could not read the recordings');
  }
}

const { controller, handlers, cacheName, revision } = headlessController(args.cache);

// Ticks in the window where the scored account is not among the streamed players.
const followGaps: [number, number][] = [];
const observed: FeedHandlers = {
  ...handlers,
  onTick(tick) {
    handlers.onTick(tick);
    if (tick.k < clip.kOffset) return;
    const inView = [...controller.world.players.values()].some((p) => canonicalAccountName(p.name) === redactor.scored);
    if (inView) return;
    const last = followGaps[followGaps.length - 1];
    if (last && last[1] === tick.k - 1) last[1] = tick.k;
    else followGaps.push([tick.k, tick.k]);
  },
};
const source = new StreamSource(frames());
const playhead = new Playhead(controller.world, observed, source);

let t0 = performance.now();
for (;;) {
  const next = source.peek();
  if (!next || next.recv >= fromMs) break;
  playhead.step();
}
console.log(
  `baseline: ${(performance.now() - t0) / 1000 | 0} s, ${source.position} frames, world tick ${controller.world.tick}, ` +
    `${controller.world.players.size} players and ${controller.world.npcs.size} npcs in view`,
);

// --- Chunks ---

const outDir = join(args.out, 'replays', clipId);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const chunks: ClipChunk[] = [];
const written: { file: string; text: string; br: Buffer }[] = [];
const markRecv = new Map<number, number>();
t0 = performance.now();
for (const data of cutChunks(playhead, clip.ticksPerChunk, toMs)) {
  const ks = data.frames.flatMap((f) => (f.msg.t === 'tick' ? [f.msg.k] : []));
  for (const f of data.frames) {
    if (f.msg.t === 'tick' && clip.marks.some((m) => m.k === (f.msg as { k: number }).k)) markRecv.set(f.msg.k, f.recv);
  }
  const text = [formatCheckpointLine(data.checkpoint), ...data.frames.map(formatFrameLine)].join('\n') + '\n';
  const sha256 = createHash('sha256').update(text).digest('hex');
  const file = `chunk-${String(chunks.length).padStart(3, '0')}.${sha256.slice(0, 8)}.jsonl`;
  const br = brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: text.length } });
  writeFileSync(join(outDir, file + '.br'), br);
  written.push({ file, text, br });
  chunks.push({
    k0: ks[0] ?? -1,
    k1: ks[ks.length - 1] ?? -1,
    recv0: data.frames[0]!.recv,
    recv1: data.frames[data.frames.length - 1]!.recv,
    f0: data.checkpoint.frameIndex,
    frames: data.frames.length,
    cycle0: data.checkpoint.world.loopCycle,
    file,
    bytes: br.length,
    sha256,
  });
}
if (chunks.length === 0) fail('the window holds no frames');
console.log(`chunks: ${chunks.length} in ${(performance.now() - t0) / 1000 | 0} s, ${written.reduce((n, w) => n + w.text.length, 0)} bytes raw, ${written.reduce((n, w) => n + w.br.length, 0)} brotli`);

// The tick numbering must agree with the timeline's clock.
for (const mark of clip.marks) {
  const recv = markRecv.get(mark.k);
  if (recv === undefined) fail(`${mark.what}: tick ${mark.k} is not in the clip`);
  const off = recv - Date.parse(mark.at);
  if (Math.abs(off) > MARK_TOLERANCE_MS) fail(`${mark.what}: tick ${mark.k} arrived ${off} ms from ${mark.at}`);
  console.log(`mark: ${mark.what} is tick ${mark.k} (session tick ${mark.k - clip.kOffset}), received ${off} ms from the timeline's ${mark.at}`);
}

// Exactly one roster slot for the scored account across the window.
const kStart = chunks[0]!.k0;
const kEnd = chunks[chunks.length - 1]!.k1;
const slots = redactor.scoredSlotsBetween(kStart, kEnd);
if (slots.length !== 1) fail(`the scored account holds ${slots.length} roster slots in the window; expected exactly 1`);
if (slots[0] !== clip.slot) fail(`the scored account holds slot ${slots[0]}, not the clip's slot ${clip.slot}: is RUNE_SCORED_ACCOUNT the record account?`);
const followName = process.env.RUNE_SCORED_ACCOUNT!.trim();

const manifest: ClipManifest = {
  v: CLIP_VERSION,
  clip: clipId,
  revision,
  cacheId: cacheName,
  follow: { name: followName, slot: slots[0]! },
  anchor: { kOffset: clip.kOffset },
  window: { kStart, kEnd, recvStart: chunks[0]!.recv0, recvEnd: chunks[chunks.length - 1]!.recv1 },
  // From login on: before it the account is simply not online, which is not a gap.
  followGaps: followGaps.filter(([, k1]) => k1 < kEnd && k1 > clip.kOffset + 1),
  subs,
  chunks,
  redaction: { ...redactor.counts, namesScanned: redactor.names.size, hits: 0 },
};

// --- Scan everything written, decompressed from disk, before anything is published ---

function scanOut(): number {
  let hits = 0;
  for (const name of readdirSync(outDir)) {
    const raw = readFileSync(join(outDir, name));
    const text = name.endsWith('.br') ? brotliDecompressSync(raw).toString('utf8') : raw.toString('utf8');
    for (const hit of scanEmitted(name, text, redactor.names, redactor.scored)) {
      hits++;
      if (hits <= 20) console.error(`scan: ${hit.what} at ${hit.where}`);
    }
  }
  return hits;
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest) + '\n');
const hits = scanOut();
console.log(
  `redaction: ${redactor.counts.rosterNamesReplaced} roster names and ${redactor.counts.appearanceNamesReplaced} appearance names ` +
    `replaced, ${redactor.counts.playerTextDropped} player texts and ${redactor.counts.npcTextDropped} NPC texts dropped, ` +
    `${redactor.names.size} names scanned for, ${hits} hits; scored account on slot ${slots[0]}; ${stats.dropped} frames dropped by the gate`,
);
if (hits > 0) {
  rmSync(outDir, { recursive: true, force: true });
  fail(`${hits} scan hit(s); output deleted`);
}
console.log(`follow gaps: ${manifest.followGaps.map(([a, b]) => `${a - clip.kOffset}-${b - clip.kOffset}`).join(', ')} (session ticks)`);
console.log(`wrote ${relative('.', outDir)}/ (${chunks.length} chunks + manifest.json)`);

// --- R2 ---

if (args.upload || args['upload-cache']) {
  const env = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;
  const missing = env.filter((k) => !process.env[k]);
  if (missing.length) fail(`--upload needs ${missing.join(', ')}`);
  const s3 = new Bun.S3Client({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  });
  const IMMUTABLE = 'public, max-age=31536000, immutable';
  if (args['upload-cache']) {
    // The store goes up as files, streamed from disk; keys.json is never read into memory here.
    const cacheDir = args.cache;
    // Streamed from disk; the store's directory is named by content, so its files are immutable.
    const put = (rel: string, type: string, cacheControl: string) =>
      fetchPut(s3, `world/cache/${rel}`, Bun.file(join(cacheDir, rel)), statSync(join(cacheDir, rel)).size, { type, cacheControl });
    for (const name of readdirSync(join(cacheDir, cacheName))) {
      await put(`${cacheName}/${name}`, name.endsWith('.json') ? 'application/json' : 'application/octet-stream', IMMUTABLE);
    }
    await put('caches.json', 'application/json', 'public, max-age=300');
  }
  if (args.upload) {
    if (scanOut() > 0) fail('the scan failed on the bytes about to be uploaded');
    for (const w of written) {
      const br = readFileSync(join(outDir, w.file + '.br'));
      await fetchPut(s3, `world/replays/${clipId}/${w.file}`, new Uint8Array(br), br.length, { type: 'application/x-ndjson', contentEncoding: 'br', cacheControl: IMMUTABLE });
    }
    const manifestBytes = readFileSync(join(outDir, 'manifest.json'));
    await fetchPut(s3, `world/replays/${clipId}/manifest.json`, new Uint8Array(manifestBytes), manifestBytes.length, { type: 'application/json', cacheControl: 'public, max-age=300' });
    console.log(`uploaded ${written.length} chunks and the manifest to world/replays/${clipId}/`);
  }
}

async function fetchPut(
  s3: Bun.S3Client,
  key: string,
  body: Uint8Array | Blob,
  size: number,
  meta: { type: string; cacheControl: string; contentEncoding?: string },
): Promise<void> {
  // Bun's S3 writer sets Content-Type; Cache-Control and Content-Encoding go through a presigned PUT.
  const url = s3.presign(key, { method: 'PUT', expiresIn: 600 });
  const headers: Record<string, string> = { 'Content-Type': meta.type, 'Cache-Control': meta.cacheControl };
  if (meta.contentEncoding) headers['Content-Encoding'] = meta.contentEncoding;
  const resp = await fetch(url, { method: 'PUT', body, headers });
  if (!resp.ok) fail(`upload of ${key} failed: HTTP ${resp.status}`);
  console.log(`uploaded ${key} (${size} bytes)`);
}

if (!existsSync(join(outDir, 'manifest.json'))) fail('manifest missing after write');
