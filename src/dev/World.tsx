import { useEffect, useState } from 'react';
import { RendererCanvas, WorldLoadError, type DownloadProgress, type MapViewer } from '@rune/world';
import { loadWorld, startWorkers } from '../replay/world';

/** Dev-only: the map around Lumbridge from the local cache, with no feed. */
export default function World() {
  const [viewer, setViewer] = useState<MapViewer>();
  const [progress, setProgress] = useState<DownloadProgress>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    let loaded: MapViewer | undefined;
    let pool: ReturnType<typeof startWorkers> | undefined;
    Promise.resolve()
      .then(() => loadWorld((pool = startWorkers()), abort.signal, setProgress))
      .then(({ viewer }) => {
        loaded = viewer;
        viewer.setCamera({ position: [3222.5, -24, 3236], pitch: -300, yaw: 0 });
        setViewer(viewer);
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) setError(e instanceof WorldLoadError ? e.message : String(e));
      });
    return () => {
      abort.abort();
      loaded?.dispose();
      void pool?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!viewer) return;
    const timer = setInterval(() => {
      const r = viewer.renderer;
      setStatus(
        `frames ${r.stats.frameCount} · squares ${r.mapManager.mapSquares.size} loaded, ` +
          `${r.mapManager.loadingMapIds.size} loading · worker tasks ${viewer.workerPool.pendingTasks}`,
      );
    }, 500);
    return () => clearInterval(timer);
  }, [viewer]);

  return (
    <>
      <p data-world-status>{status}</p>
      <div style={{ height: '70vh', background: 'black', position: 'relative' }}>
        {error && <p role="alert">{error}</p>}
        {!viewer && !error && <p>Loading cache {progress ? `${progress.current} / ${progress.total}` : ''}</p>}
        {viewer && <RendererCanvas renderer={viewer.renderer} />}
      </div>
    </>
  );
}
