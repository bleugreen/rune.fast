/**
 * Scans the built site for identifiers that must never be published (the patterns, cairn
 * addresses among them, live in forbidden.ts, shared with the replay clip scan; the harness
 * page's taught addresses in src/harness/addresses.ts are the one exemption), and checks that the licences the 3D replay
 * ships under are in it, and that each page's HTML carries its own head (src/meta.ts). Run after `bun run build`,
 * under scripts/test-preload.ts (package.json `check:public`); exits non-zero on any hit.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TAUGHT } from '../src/harness/addresses';
import { HEAD_MARKER, NOT_FOUND_FILE, PAGE_PATHS, headTags, pageFile, siteMeta } from '../src/meta';
import { FORBIDDEN, withoutAddresses } from './forbidden';
import { filesUnder, pagesRoutes } from './pages-routes';

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(html|js|css|json|txt|map|md)$/.test(name)) yield p;
  }
}

let hits = 0;
for (const f of files('dist')) {
  // The harness page's taught addresses are subject matter; any other address still fails.
  const text = withoutAddresses(readFileSync(f, 'utf8'), TAUGHT);
  for (const [what, re] of FORBIDDEN) {
    const m = re.exec(text);
    if (m) {
      hits++;
      console.error(`${f}: ${what}: …${text.slice(Math.max(0, m.index - 40), m.index + 40)}…`);
    }
  }
}

const REQUIRED = ['dist/licenses/LICENSE.txt', 'dist/licenses/UPSTREAM.md'];
for (const f of REQUIRED) {
  if (!existsSync(f)) {
    hits++;
    console.error(`check-public: ${f} is missing (the replay engine's licence and provenance)`);
  }
}
if (!readdirSync('dist/assets').some((f) => /^wasm_gzip_bg-.*\.wasm$/.test(f))) {
  hits++;
  console.error('check-public: no wasm-gzip module in dist/assets; the replay would fall back to pako');
}

// Without a matching _routes.json, Pages would run the Function for every request.
const routes = existsSync('dist/_routes.json') ? readFileSync('dist/_routes.json', 'utf8') : undefined;
if (routes === undefined || JSON.stringify(JSON.parse(routes)) !== JSON.stringify(pagesRoutes(filesUnder('dist')))) {
  hits++;
  console.error('check-public: dist/_routes.json is missing or does not match the build (scripts/pages-routes.ts)');
}

// Each page's own HTML with its own head, the same app, and the page itself in the app's root
// (scripts/page-heads.ts); Nothing here's for every other path.
const home = existsSync('dist/index.html') ? readFileSync('dist/index.html', 'utf8') : '';
const entry = /<script type="module"[^>]*><\/script>/.exec(home)?.[0] ?? '<no entry script>';
const meta = siteMeta();
const pages = [...PAGE_PATHS.map((p) => [pageFile(p), p, headTags(meta[p])] as const), [NOT_FOUND_FILE, '*', ['<meta name="robots" content="noindex" />']] as const];
for (const [file, page, head] of pages) {
  const f = join('dist', file);
  const html = existsSync(f) ? readFileSync(f, 'utf8') : '';
  const missing = head.filter((t) => !html.includes(t));
  const rendered = html.includes(`<div id="root" data-prerendered="${page}"><div`);
  if (!html || missing.length || html.includes(HEAD_MARKER) || !html.includes(entry) || !rendered) {
    hits++;
    console.error(`check-public: ${f} is missing, lacks its head (${missing[0] ?? 'or the marker is unspent'}), its entry script, or its page in the root`);
  }
}

if (hits) {
  console.error(`check-public: ${hits} problem(s) in dist/`);
  process.exit(1);
}
console.log(
  'check-public: dist/ carries no forbidden identifiers, the replay licences and wasm are present, _routes.json matches the build, and every page has its own head and its page rendered in',
);
