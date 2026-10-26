import { CacheFiles, ProgressListener } from "../rs/cache/CacheFiles";
import { CacheInfo, getLatestCache } from "../rs/cache/CacheInfo";
import { CacheType, detectCacheType } from "../rs/cache/CacheType";
import { isSharedMemorySupported } from "../util/DeviceUtil";

const CACHE_PATH = process.env.PUBLIC_URL + "/caches/";

// Messages of this type are safe and actionable to show the operator verbatim.
export class WorldLoadError extends Error {}

export async function fetchCacheInfos(): Promise<CacheInfo[]> {
    const resp = await fetch(CACHE_PATH + "caches.json");
    if (!resp.ok) throw new WorldLoadError("Local cache missing or corrupt · run sync-cache");
    const infos: CacheInfo[] = await resp.json();
    if (!Array.isArray(infos) || infos.length !== 1 || !/^rs-sdk-[a-zA-Z0-9._-]+$/.test(infos[0].name) || !Number.isInteger(infos[0].revision)) throw new WorldLoadError("Invalid local cache manifest · run sync-cache");
    return infos;
}

export type CacheList = {
    caches: CacheInfo[];
    latest: CacheInfo;
};

export async function fetchCacheList(): Promise<CacheList | undefined> {
    const caches = await fetchCacheInfos();
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
    info: CacheInfo,
    signal?: AbortSignal,
    progressListener?: ProgressListener,
): Promise<LoadedCache> {
    const cachePath = CACHE_PATH + info.name + "/";

    const xteasPromise = fetchXteas(cachePath + "keys.json", signal);

    const cacheType = detectCacheType(info);
    const files = await CacheFiles.fetchFiles(
        cacheType,
        cachePath,
        info.name,
        isSharedMemorySupported,
        signal,
        progressListener,
    );

    const xteas = await xteasPromise;

    return {
        info,
        type: cacheType,
        files,
        xteas,
    };
}

export type XteaMap = Map<number, number[]>;

export async function fetchXteas(url: RequestInfo, signal?: AbortSignal): Promise<XteaMap> {
    const resp = await fetch(url, {
        signal,
    });
    const data: Record<string, number[]> = await resp.json();
    return new Map(Object.keys(data).map((key) => [parseInt(key), data[key]]));
}
