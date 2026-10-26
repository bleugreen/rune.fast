import { useEffect, useState } from 'react';
import { RendererCanvas, WorldLoadError, type DownloadProgress, type MapViewer } from '@rune/world';
import { loadWorld } from '../replay/world';

/** Dev-only: the map around Lumbridge from the local cache, with no feed. */
export default function World() {
  const [viewer, setViewer] = useState<MapViewer>();
  const [progress, setProgress] = useState<DownloadProgress>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const abort = new AbortController();
    let loaded: MapViewer | undefined;
    loadWorld(abort.signal, setProgress)
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
    };
  }, []);

  return (
    <div style={{ height: '75vh', background: 'black', position: 'relative' }}>
      {error && <p role="alert">{error}</p>}
      {!viewer && !error && <p>Loading cache {progress ? `${progress.current} / ${progress.total}` : ''}</p>}
      {viewer && <RendererCanvas renderer={viewer.renderer} />}
    </div>
  );
}
