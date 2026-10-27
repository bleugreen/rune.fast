/**
 * The site's video clips, which live in the R2 bucket under world/clips/, not in git. Each video in
 * data/clips.json names its file by its key under the world assets, clips/<id>.<sha8>.mp4: the name
 * carries the content, so the object is immutable, and .world/ mirrors it for dev and preview.
 *
 *   bun scripts/world/publish-videos.ts --add <id> <cut.mp4>     into .world/clips/; prints the entry's src, bytes and facts
 *   bun --env-file=<r2.env> scripts/world/publish-videos.ts --upload
 *                                                              every registered video .world/clips/ holds, onto R2
 *   bun scripts/world/publish-videos.ts --check                  the bucket's answers for every registered video
 *   bun scripts/world/publish-videos.ts --pull                   fetch the registered videos .world/clips/ lacks
 *
 * --dir names the local mirror (default .world), --base the served world assets
 * (default https://assets.mage.md/world/), and --only a comma-separated list of ids, so an upload
 * puts exactly the videos it was cleared for and a check reports on just those.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { CLIPS, type VideoEntry } from '../../src/clips/registry';
import { contentTag, mp4Facts } from './media';
import { IMMUTABLE, putObject, r2Client } from './r2';

/** The origin the bucket's CORS policy must answer for: the site. */
const SITE = 'https://rune.fast';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    add: { type: 'string' },
    upload: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    pull: { type: 'boolean', default: false },
    dir: { type: 'string', default: '.world' },
    base: { type: 'string', default: 'https://assets.mage.md/world/' },
    only: { type: 'string' },
  },
});

const only = args.only?.split(',').map((id) => id.trim());
const unknown = only?.filter((id) => !CLIPS.some((c) => c.id === id && c.kind === 'video'));
if (unknown?.length) throw new Error(`--only names no registered video: ${unknown.join(', ')}`);
const videos = CLIPS.filter((c): c is VideoEntry => c.kind === 'video' && (!only || only.includes(c.id)));
const local = (v: VideoEntry) => join(args.dir, v.src);
let failures = 0;
const bad = (line: string) => {
  failures++;
  console.error(`  FAIL ${line}`);
};

if (args.add) {
  const file = positionals[0];
  if (!file) throw new Error('--add <id> <cut.mp4>');
  const buf = readFileSync(file);
  const src = `clips/${args.add}.${contentTag(buf)}.mp4`;
  mkdirSync(join(args.dir, 'clips'), { recursive: true });
  copyFileSync(file, join(args.dir, src));
  console.log(JSON.stringify({ id: args.add, src, bytes: buf.length, ...mp4Facts(buf) }));
}

if (args.upload) {
  const s3 = r2Client();
  for (const v of videos) {
    if (!existsSync(local(v))) {
      bad(`${v.id}: ${local(v)} is not here to upload`);
      continue;
    }
    const buf = readFileSync(local(v));
    if (buf.length !== v.bytes || !v.src.includes(`.${contentTag(buf)}.`)) {
      bad(`${v.id}: ${local(v)} is not the file data/clips.json names`);
      continue;
    }
    await putObject(s3, `world/${v.src}`, new Uint8Array(buf), buf.length, { type: 'video/mp4', cacheControl: IMMUTABLE });
  }
}

if (args.pull) {
  for (const v of videos) {
    if (existsSync(local(v))) continue;
    const resp = await fetch(args.base + v.src);
    if (!resp.ok) {
      bad(`${v.id}: ${args.base + v.src}: HTTP ${resp.status}`);
      continue;
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.length !== v.bytes || !v.src.includes(`.${contentTag(buf)}.`)) {
      bad(`${v.id}: what the bucket serves is not the file data/clips.json names`);
      continue;
    }
    mkdirSync(dirname(local(v)), { recursive: true });
    writeFileSync(local(v), buf);
    console.log(`pulled ${v.src} (${buf.length} bytes)`);
  }
}

if (args.check) {
  // What a page on the site asks: the object, from the site's origin, and a byte range, as a video seek does.
  for (const v of videos) {
    const url = args.base + v.src;
    console.log(v.src);
    const head = await fetch(url, { method: 'HEAD', headers: { Origin: SITE } });
    const h = (k: string) => head.headers.get(k);
    if (head.status !== 200) bad(`HEAD: HTTP ${head.status}`);
    if (h('content-type') !== 'video/mp4') bad(`Content-Type ${h('content-type')}`);
    if (Number(h('content-length')) !== v.bytes) bad(`Content-Length ${h('content-length')}, the registry says ${v.bytes}`);
    if (!h('cache-control')?.includes('immutable')) bad(`Cache-Control ${h('cache-control')}`);
    if (h('cross-origin-resource-policy') !== 'cross-origin') bad(`Cross-Origin-Resource-Policy ${h('cross-origin-resource-policy')}`);
    const acao = h('access-control-allow-origin');
    if (acao !== '*' && acao !== SITE) bad(`Access-Control-Allow-Origin ${acao}`);
    const range = await fetch(url, { headers: { Origin: SITE, Range: 'bytes=0-1' } });
    await range.arrayBuffer();
    if (range.status !== 206) bad(`Range bytes=0-1: HTTP ${range.status}, not 206`);
    if (range.headers.get('content-range') !== `bytes 0-1/${v.bytes}`) bad(`Content-Range ${range.headers.get('content-range')}`);
    if (!failures) console.log(`  ok: 200 video/mp4, ${v.bytes} bytes, immutable, CORP cross-origin, CORS ${acao}, Range 206`);
  }
}

if (!args.add && !args.upload && !args.pull && !args.check) throw new Error('one of --add, --upload, --check or --pull');
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
