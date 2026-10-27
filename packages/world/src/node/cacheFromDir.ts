import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CacheFiles } from "../rs/cache/CacheFiles";
import { CacheInfo } from "../rs/cache/CacheInfo";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { detectCacheType } from "../rs/cache/CacheType";
import { CacheLoaderFactory, getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";

// The cache store from disk, for headless replays in bun (publish, bench). Reads caches.json and
// the dat store's data and index files. The simulation needs config, sequences and frames but no
// map files, so the XTEA keys (keys.json) are never opened.
export function loadCacheFromDir(dir: string): { info: CacheInfo; loaderFactory: CacheLoaderFactory } {
    const infos = JSON.parse(readFileSync(join(dir, "caches.json"), "utf8")) as CacheInfo[];
    if (!Array.isArray(infos) || infos.length !== 1) throw new Error("caches.json must list exactly one store");
    const info = infos[0];
    const type = detectCacheType(info);
    if (type !== "dat") throw new Error("Only dat caches load from disk");
    const files = new Map<string, ArrayBufferLike>();
    const read = (name: string) => {
        const bytes = readFileSync(join(dir, info.name, name));
        files.set(name, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    };
    read(CacheFiles.DAT_FILE_NAME);
    for (let i = 0; i < CacheFiles.DAT_INDEX_COUNT; i++) read(CacheFiles.INDEX_FILE_PREFIX + i);
    const system = CacheSystem.fromFiles(type, new CacheFiles(files));
    return { info, loaderFactory: getCacheLoaderFactory(info, system) };
}
