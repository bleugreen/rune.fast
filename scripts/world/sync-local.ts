/**
 * Copies the rs-sdk revision 289 cache store from an rs-dash checkout into .world/cache/, where
 * the dev and preview servers serve it at /world-assets/cache/ and publish-clip reads it.
 *
 *   bun scripts/world/sync-local.ts <rs-dash>/caches
 *
 * Files are copied byte for byte and never opened, except the two manifests, which are checked:
 * caches.json must name exactly one rs-sdk store and carry no local paths, and info.json's size
 * must match the .dat. keys.json (the map XTEA keys) is only ever copied.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('usage: bun scripts/world/sync-local.ts <rs-dash>/caches');
  process.exit(2);
}
const target = '.world/cache';

const LOCAL_PATH = /\/Users\/|\/home\/|file:|[A-Za-z]:\\/;
const STORE_FILES = /^(main_file_cache\.(dat|idx[0-4])|keys\.json|info\.json)$/;

function fail(message: string): never {
  console.error(`sync-local: ${message}`);
  process.exit(1);
}

const manifestText = readFileSync(join(source, 'caches.json'), 'utf8');
if (LOCAL_PATH.test(manifestText)) fail('caches.json carries a local path; refusing to copy it');
const manifest = JSON.parse(manifestText) as { name?: unknown; revision?: unknown }[];
if (!Array.isArray(manifest) || manifest.length !== 1) fail('caches.json must list exactly one store');
const name = manifest[0]!.name;
if (typeof name !== 'string' || !/^rs-sdk-289-[a-f0-9]+$/.test(name)) fail('caches.json does not name an rs-sdk revision 289 store');
if (manifest[0]!.revision !== 289) fail('caches.json revision is not 289');

const storeDir = join(source, name);
const info = JSON.parse(readFileSync(join(storeDir, 'info.json'), 'utf8')) as { size?: unknown };
if (LOCAL_PATH.test(JSON.stringify(info))) fail('info.json carries a local path');
const datSize = statSync(join(storeDir, 'main_file_cache.dat')).size;
if (info.size !== datSize) fail(`info.json size ${String(info.size)} does not match main_file_cache.dat (${datSize} bytes)`);

const files = readdirSync(storeDir).filter((f) => STORE_FILES.test(f)).sort();
for (const required of ['main_file_cache.dat', 'main_file_cache.idx0', 'main_file_cache.idx4', 'keys.json', 'info.json']) {
  if (!files.includes(required)) fail(`store is missing ${required}`);
}

mkdirSync(join(target, name), { recursive: true });
copyFileSync(join(source, 'caches.json'), join(target, 'caches.json'));
let bytes = 0;
for (const f of files) {
  copyFileSync(join(storeDir, f), join(target, name, f));
  bytes += statSync(join(target, name, f)).size;
}
console.log(`sync-local: ${name}, ${files.length} files, ${bytes} bytes -> ${target}/`);
