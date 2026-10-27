/**
 * The site's stills too large for git, screenshots above all, which live in the R2 bucket under
 * world/figures/, beside the clips. data/figures.json registers each one: its source image by SHA-256,
 * the rectangles masked out of it, and its renditions, each named by its content
 * (figures/<id>.<width>.<sha8>.<ext>) so the object is immutable; .world/ mirrors them for dev and preview.
 *
 *   bun scripts/figures/publish-figures.ts --build <id> <source.png>  mask and encode into .world/figures/,
 *                                                                      and write the entry's renditions
 *   bun --env-file=<r2.env> scripts/figures/publish-figures.ts --upload
 *                                                                      every registered rendition .world/ holds, onto R2
 *   bun scripts/figures/publish-figures.ts --check                     the bucket's answers for every registered rendition
 *   bun scripts/figures/publish-figures.ts --pull                      fetch the registered renditions .world/ lacks
 *
 * --dir, --base and --only work as in scripts/world/publish-videos.ts. --build runs on the operator's
 * Mac, where the sources are: it needs ImageMagick with AVIF and WebP, and the system's sRGB profile.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { FIGURES, type FigureEntry, type Rendition } from '../../src/figures/registry';
import { avifSize, contentTag, jpegSize, webpSize } from '../world/media';
import { IMMUTABLE, putObject, r2Client } from '../world/r2';

/** The origin the bucket's CORS policy must answer for: the site. */
const SITE = 'https://rune.fast';
const REGISTRY = 'data/figures.json';

const SRGB = '/System/Library/ColorSync/Profiles/sRGB Profile.icc';
/** A flat grey between the panes' ground and their text: the reader sees that something was taken out. */
const MASK_FILL = 'rgb(64,63,58)';
/** About twice the widest the page draws a figure (68rem on the harness page). */
const COLUMN_WIDTH = 2048;

/**
 * What each figure is published as. The column is what the page draws, AVIF with a JPEG for
 * browsers without it. The full size keeps every source pixel for reading the panes' text;
 * lossless WebP is both exact and, for flat interface screenshots, smaller than lossy WebP.
 */
const OUTPUTS: ReadonlyArray<{ use: Rendition['use']; type: Rendition['type']; ext: string; args: string[] }> = [
  { use: 'column', type: 'image/avif', ext: 'avif', args: ['-filter', 'Lanczos', '-resize', `${COLUMN_WIDTH}x`, '-quality', '60'] },
  {
    use: 'column',
    type: 'image/jpeg',
    ext: 'jpg',
    args: ['-filter', 'Lanczos', '-resize', `${COLUMN_WIDTH}x`, '-quality', '82', '-sampling-factor', '4:2:0', '-interlace', 'JPEG'],
  },
  { use: 'full', type: 'image/webp', ext: 'webp', args: ['-define', 'webp:lossless=true', '-define', 'webp:method=6'] },
];

function sizeOf(type: Rendition['type'], buf: Buffer): { width: number; height: number } {
  return type === 'image/avif' ? avifSize(buf) : type === 'image/webp' ? webpSize(buf) : jpegSize(buf);
}

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    build: { type: 'string' },
    upload: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    pull: { type: 'boolean', default: false },
    dir: { type: 'string', default: '.world' },
    base: { type: 'string', default: 'https://assets.mage.md/world/' },
    only: { type: 'string' },
  },
});

const only = args.only?.split(',').map((id) => id.trim());
const unknown = only?.filter((id) => !FIGURES.some((f) => f.id === id));
if (unknown?.length) throw new Error(`--only names no registered figure: ${unknown.join(', ')}`);
const figures = FIGURES.filter((f) => !only || only.includes(f.id));
const renditions = figures.flatMap((f) => f.renditions);
const local = (r: Rendition) => join(args.dir, r.src);
let failures = 0;
const bad = (line: string) => {
  failures++;
  console.error(`  FAIL ${line}`);
};

function magick(...argv: string[]): string {
  const p = Bun.spawnSync(['magick', ...argv], { stdout: 'pipe', stderr: 'pipe' });
  if (p.exitCode !== 0) throw new Error(`magick ${argv.join(' ')}: ${p.stderr.toString()}`);
  return p.stdout.toString();
}

/** Throws unless every mask of `f` is one flat colour in `file`, at the source's own scale. */
function assertMasked(f: FigureEntry, file: string) {
  for (const m of f.masks) {
    const spread = magick(file, '-crop', `${m.width}x${m.height}+${m.x}+${m.y}`, '+repage', '-format', '%[fx:maxima-minima]', 'info:');
    if (Number(spread) !== 0) throw new Error(`${file}: the mask over ${m.what} is not solid (spread ${spread})`);
  }
}

function build(f: FigureEntry, file: string): Rendition[] {
  const buf = readFileSync(file);
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== f.source.sha256) throw new Error(`${file} is not ${f.id}'s source: SHA-256 ${sha}`);
  // The PNG's IHDR: width and height, big-endian, at bytes 16 and 20.
  if (buf.readUInt32BE(16) !== f.source.width || buf.readUInt32BE(20) !== f.source.height) throw new Error(`${file} is not ${f.source.width}x${f.source.height}`);
  for (const m of f.masks) {
    if (m.x < 0 || m.y < 0 || m.x + m.width > f.source.width || m.y + m.height > f.source.height) throw new Error(`the mask over ${m.what} leaves the image`);
  }

  const tmp = mkdtempSync(join(tmpdir(), `figure-${f.id}-`));
  try {
    // Into sRGB from the source's own profile, then no metadata at all, then the masks: nothing else changes.
    const masked = join(tmp, 'masked.png');
    const rects = f.masks.flatMap((m) => ['-draw', `rectangle ${m.x},${m.y} ${m.x + m.width - 1},${m.y + m.height - 1}`]);
    magick(file, '-profile', SRGB, '-strip', '-fill', MASK_FILL, ...rects, masked);
    assertMasked(f, masked);

    const out: Rendition[] = [];
    for (const o of OUTPUTS) {
      const encoded = join(tmp, `${o.use}.${o.ext}`);
      magick(masked, ...o.args, '-strip', encoded);
      if (o.use === 'full') assertMasked(f, encoded);
      const bytes = readFileSync(encoded);
      const { width, height } = sizeOf(o.type, bytes);
      const src = `figures/${f.id}.${width}.${contentTag(bytes)}.${o.ext}`;
      mkdirSync(join(args.dir, 'figures'), { recursive: true });
      copyFileSync(encoded, join(args.dir, src));
      out.push({ use: o.use, type: o.type, width, height, src, bytes: bytes.length });
      console.log(`${src}  ${width}x${height}  ${bytes.length} bytes`);
    }
    return out;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (args.build) {
  const file = positionals[0];
  if (!file) throw new Error('--build <id> <source.png>');
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8')) as FigureEntry[];
  const entry = registry.find((f) => f.id === args.build);
  if (!entry) throw new Error(`no figure registered as ${args.build} in ${REGISTRY}`);
  entry.renditions = build(entry, file);
  writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + '\n');
}

if (args.upload) {
  const s3 = r2Client();
  for (const r of renditions) {
    if (!existsSync(local(r))) {
      bad(`${local(r)} is not here to upload`);
      continue;
    }
    const buf = readFileSync(local(r));
    if (buf.length !== r.bytes || !r.src.includes(`.${contentTag(buf)}.`)) {
      bad(`${local(r)} is not the file ${REGISTRY} names`);
      continue;
    }
    await putObject(s3, `world/${r.src}`, new Uint8Array(buf), buf.length, { type: r.type, cacheControl: IMMUTABLE });
  }
}

if (args.pull) {
  for (const r of renditions) {
    if (existsSync(local(r))) continue;
    const resp = await fetch(args.base + r.src);
    if (!resp.ok) {
      bad(`${args.base + r.src}: HTTP ${resp.status}`);
      continue;
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.length !== r.bytes || !r.src.includes(`.${contentTag(buf)}.`)) {
      bad(`${r.src}: what the bucket serves is not the file ${REGISTRY} names`);
      continue;
    }
    mkdirSync(dirname(local(r)), { recursive: true });
    writeFileSync(local(r), buf);
    console.log(`pulled ${r.src} (${buf.length} bytes)`);
  }
}

if (args.check) {
  // What a page on the site asks: the image, from the site's origin, which its COEP lets in only with CORP.
  for (const r of renditions) {
    const before = failures;
    const url = args.base + r.src;
    console.log(r.src);
    const resp = await fetch(url, { headers: { Origin: SITE } });
    const h = (k: string) => resp.headers.get(k);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (resp.status !== 200) bad(`GET: HTTP ${resp.status}`);
    if (h('content-type') !== r.type) bad(`Content-Type ${h('content-type')}, the registry says ${r.type}`);
    if (buf.length !== r.bytes) bad(`${buf.length} bytes, the registry says ${r.bytes}`);
    if (!r.src.includes(`.${contentTag(buf)}.`)) bad(`the content is not the file its name carries`);
    else {
      const { width, height } = sizeOf(r.type, buf);
      if (width !== r.width || height !== r.height) bad(`${width}x${height}, the registry says ${r.width}x${r.height}`);
    }
    if (!h('cache-control')?.includes('immutable')) bad(`Cache-Control ${h('cache-control')}`);
    if (h('cross-origin-resource-policy') !== 'cross-origin') bad(`Cross-Origin-Resource-Policy ${h('cross-origin-resource-policy')}`);
    const acao = h('access-control-allow-origin');
    if (acao !== '*' && acao !== SITE) bad(`Access-Control-Allow-Origin ${acao}`);
    if (failures === before) console.log(`  ok: 200 ${r.type}, ${r.bytes} bytes, ${r.width}x${r.height}, immutable, CORP cross-origin, CORS ${acao}`);
  }
}

if (!args.build && !args.upload && !args.pull && !args.check) throw new Error('one of --build, --upload, --check or --pull');
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
