import { WorldLoadError, fetchCacheList, loadCacheFiles, type LoadedCache } from '@rune/world/mapviewer/Caches';
import type { DownloadProgress } from '@rune/world/rs/cache/CacheFiles';
import { WORLD_ASSET_BASE } from './assets';

type Download = {
  done: Promise<LoadedCache>;
  listeners: Set<(progress: DownloadProgress) => void>;
  last?: DownloadProgress;
};

let current: Download | undefined;

function startDownload(): Download {
  const download: Download = { done: undefined as never, listeners: new Set() };
  download.done = (async () => {
    const list = await fetchCacheList(WORLD_ASSET_BASE);
    if (!list) throw new WorldLoadError('The game cache is unavailable');
    return loadCacheFiles(WORLD_ASSET_BASE, list.latest, undefined, (progress) => {
      download.last = progress;
      for (const listener of download.listeners) listener(progress);
    });
  })().finally(() => {
    if (current === download) current = undefined;
  });
  return download;
}

/**
 * The game cache, from Cache Storage when the engine has stored it there, otherwise downloaded
 * into it. There is one download at a time, and every caller that arrives while it runs joins it:
 * two concurrent downloads would each store their resumable parts under the same keys with
 * different byte boundaries, and a later resume could stitch them wrongly.
 *
 * A download runs to completion even when every caller has gone, since what it stores is reused
 * either way. Aborting `signal` only detaches this caller's progress listener; the caller checks
 * the signal itself once this resolves.
 */
export function loadCache(signal?: AbortSignal, onProgress?: (progress: DownloadProgress) => void): Promise<LoadedCache> {
  const download = (current ??= startDownload());
  if (!onProgress) return download.done;
  download.listeners.add(onProgress);
  if (download.last) onProgress(download.last);
  const detach = () => download.listeners.delete(onProgress);
  signal?.addEventListener('abort', detach, { once: true });
  return download.done.finally(() => {
    detach();
    signal?.removeEventListener('abort', detach);
  });
}
