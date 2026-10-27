import { CacheFiles, ProgressListener } from "../rs/cache/CacheFiles";
import { CacheInfo, getLatestCache } from "../rs/cache/CacheInfo";
import { CacheType, detectCacheType } from "../rs/cache/CacheType";
import { isSharedMemorySupported } from "../util/DeviceUtil";

// The cache store lives under <assetBase>cache/: caches.json naming exactly one rs-sdk store, and
// that store's directory. assetBase ends in a slash.
function cachePath(assetBase: string): string {
    return assetBase + "cache/";
}

// Messages of this type are safe to show the reader verbatim.
export class WorldLoadError extends Error {}

export async function fetchCacheInfos(assetBase: string): Promise<CacheInfo[]> {
    const resp = await fetch(cachePath(assetBase) + "caches.json");
    if (!resp.ok) throw new WorldLoadError("The game cache is unavailable");
    const infos: CacheInfo[] = await resp.json();
    if (
        !Array.isArray(infos) ||
        infos.length !== 1 ||
        !/^rs-sdk-[a-zA-Z0-9._-]+$/.test(infos[0].name) ||
        !Number.isInteger(infos[0].revision)
    ) {
        throw new WorldLoadError("The game cache manifest is invalid");
    }
    return infos;
}

export type CacheList = {
    caches: CacheInfo[];
    latest: CacheInfo;
};

export async function fetchCacheList(assetBase: string): Promise<CacheList | undefined> {
    const caches = await fetchCacheInfos(assetBase);
    const latest = getLatestCache(caches);
    if (!latest) {
        return undefined;
    }
    return {
        caches,
        latest,
    };
}

export type LoadedCache = {
    info: CacheInfo;
    type: CacheType;
    files: CacheFiles;
    xteas: XteaMap;
};

export async function loadCacheFiles(
    assetBase: string,
    info: CacheInfo,
    signal?: AbortSignal,
    progressListener?: ProgressListener,
): Promise<LoadedCache> {
    const storePath = cachePath(assetBase) + info.name + "/";

    const cacheType = detectCacheType(info);
    // Together, so an abort or failure in either never leaves the other's rejection unhandled.
    const [files, xteas] = await Promise.all([
        CacheFiles.fetchFiles(
            cacheType,
            storePath,
            info.name,
            isSharedMemorySupported,
            signal,
            progressListener,
        ),
        fetchXteas(storePath + "keys.json", signal),
    ]);

    return {
        info,
        type: cacheType,
        files,
        xteas,
    };
}

export type XteaMap = Map<number, number[]>;

export function parseXteas(data: Record<string, number[]>): XteaMap {
    return new Map(Object.keys(data).map((key) => [parseInt(key), data[key]]));
}

export async function fetchXteas(url: RequestInfo, signal?: AbortSignal): Promise<XteaMap> {
    const resp = await fetch(url, {
        signal,
    });
    if (!resp.ok) throw new WorldLoadError("The game cache is unavailable");
    return parseXteas(await resp.json());
}
