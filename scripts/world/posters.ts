/**
 * Encodes the AVIF beside each registered clip poster (public/clips/<id>.jpg to .avif) where it is
 * missing or older than its JPEG; with --all, every one. cut-recording.ts writes its posters' AVIFs
 * itself; this is for the replay posters, shot by hand with shoot.ts --bare, and for re-encoding.
 *
 *   bun scripts/world/posters.ts [--all]
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CLIPS, posterAvif } from '../../src/clips/registry';
import { encodePosterAvif } from './media';

const all = process.argv.includes('--all');
for (const c of CLIPS) {
  const [jpg, avif] = [join('public', c.poster), join('public', posterAvif(c))];
  if (!all && existsSync(avif) && statSync(avif).mtimeMs >= statSync(jpg).mtimeMs) continue;
  encodePosterAvif(jpg);
  console.log(`${avif}  ${statSync(jpg).size} -> ${statSync(avif).size} bytes`);
}
