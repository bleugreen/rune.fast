import {
  MapViewer,
  RenderDataWorkerPool,
  WebGLMapViewerRenderer,
  WorldLoadError,
  fetchCacheList,
  isSharedMemorySupported,
  loadCacheFiles,
  type DownloadProgress,
} from '@rune/world';
import { WORLD_ASSET_BASE } from './assets';

export type LoadedWorld = { viewer: MapViewer; pool: RenderDataWorkerPool };

/**
 * Fetches the game cache and starts the renderer's worker pool. Four workers share the cache
 * when the page is cross-origin isolated (SharedArrayBuffer); otherwise one worker gets a copy.
 */
export async function loadWorld(
  signal: AbortSignal,
  onProgress: (progress: DownloadProgress) => void,
): Promise<LoadedWorld> {
  if (!WebGLMapViewerRenderer.isSupported()) throw new WorldLoadError('This browser has no WebGL2');
  const list = await fetchCacheList(WORLD_ASSET_BASE);
  if (!list) throw new WorldLoadError('The game cache is unavailable');
  const cache = await loadCacheFiles(WORLD_ASSET_BASE, list.latest, signal, onProgress);
  signal.throwIfAborted();
  const pool = RenderDataWorkerPool.create(isSharedMemorySupported ? 4 : 1);
  console.info(`[world] crossOriginIsolated=${String(crossOriginIsolated)} workers=${pool.size}`);
  return { viewer: new MapViewer(pool, cache), pool };
}
