/**
 * Scans the built site for identifiers that must never be published.
 * Run after `vite build`; exits non-zero on any hit.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ['fleet helper or test account', /\bcairn_[a-z][a-z0-9]*/],
  ['lab account', /\bdr\d{4}[a-z]\b/],
  ['machine hostname', /\bbgsrv|ashburn|\.ts\.net\b|\.local\b/i],
  ['game-process token', /\bmv[a-z0-9]{6}\b/],
  ['home directory path', /\/Users\/|\/home\//],
  ['message id field', /msg_id/],
  ['IPv4 address', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
];

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(html|js|css|json|txt|map)$/.test(name)) yield p;
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
if (hits) {
  console.error(`check-public: ${hits} forbidden identifier(s) in dist/`);
  process.exit(1);
}
console.log('check-public: dist/ carries no forbidden identifiers');
