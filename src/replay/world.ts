import {
  MapViewer,
  RenderDataWorkerPool,
  WebGLMapViewerRenderer,
  WorldLoadError,
  isSharedMemorySupported,
  type DownloadProgress,
} from '@rune/world';
import { loadCache } from './cache';

export type LoadedWorld = { viewer: MapViewer; pool: RenderDataWorkerPool };

/**
 * Starts the renderer's worker pool: four workers sharing the cache when the page is cross-origin
 * isolated (SharedArrayBuffer), otherwise one worker given a copy. Started ahead of the cache
 * download so the workers' module load and wasm init overlap it. Nothing reaches a worker until
 * `loadWorld` hands the pool the cache (MapViewer posts `initCache` first, and a worker takes its
 * messages in order), so no request can arrive before the cache does.
 */
export function startWorkers(): RenderDataWorkerPool {
  if (!WebGLMapViewerRenderer.isSupported()) throw new WorldLoadError('This browser has no WebGL2');
  const pool = RenderDataWorkerPool.create(isSharedMemorySupported ? 4 : 1);
  performance.mark('replay:workers-started');
  console.info(`[world] crossOriginIsolated=${String(crossOriginIsolated)} workers=${pool.size}`);
  return pool;
}

/** Fetches the game cache and builds the viewer on the started pool. */
export async function loadWorld(
  pool: RenderDataWorkerPool,
  signal: AbortSignal,
  onProgress: (progress: DownloadProgress) => void,
): Promise<LoadedWorld> {
  const cache = await loadCache(signal, onProgress);
  performance.mark('replay:cache-fetched');
  signal.throwIfAborted();
  const viewer = new MapViewer(pool, cache);
  performance.mark('replay:cache-indexed');
  return { viewer, pool };
}
