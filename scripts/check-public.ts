/**
 * Scans the built site for identifiers that must never be published (the patterns, cairn
 * addresses among them, live in forbidden.ts, shared with the replay clip scan), and checks that the licences the 3D replay
 * ships under are in it. Run after `vite build`; exits non-zero on any hit.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FORBIDDEN } from './forbidden';
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
  const text = readFileSync(f, 'utf8');
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

if (hits) {
  console.error(`check-public: ${hits} problem(s) in dist/`);
  process.exit(1);
}
console.log('check-public: dist/ carries no forbidden identifiers, the replay licences and wasm are present, and _routes.json matches the build');
