import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  OVERLAY_FONTS,
  RendererCanvas,
  WorldLoadError,
  type DownloadProgress,
  type LiveController,
  type WebGLMapViewerRenderer,
} from '@rune/world';
import { parseChunk, type ChunkData, type ClipChunk, type ClipManifest } from '@rune/world/replay/clip';
import { ReplayDriver, type ReplaySpeed } from '@rune/world/replay/ReplayDriver';
import { fmtInt } from '../lib/numbers';
import type { ReplayClip } from './clips';
import { RosterPicker } from './RosterPicker';
import { Timeline } from './Timeline';
import { loadWorld, type LoadedWorld } from './world';
import styles from './Replay.module.css';

const REVISION = 289;

async function fetchManifest(base: string): Promise<ClipManifest> {
  const resp = await fetch(base + 'manifest.json');
  if (!resp.ok) throw new WorldLoadError('The replay is unavailable');
  const manifest = (await resp.json()) as ClipManifest;
  if (manifest.v !== 1 || manifest.revision !== REVISION) throw new WorldLoadError('The replay was made for a different version');
  return manifest;
}

async function fetchChunk(base: string, chunk: ClipChunk): Promise<ChunkData> {
  const resp = await fetch(base + chunk.file);
  if (!resp.ok) throw new Error(`Replay chunk ${chunk.file}: HTTP ${resp.status}`);
  const text = await resp.text();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== chunk.sha256) throw new Error(`Replay chunk ${chunk.file} failed its checksum`);
  return parseChunk(text, REVISION);
}

type Ready = LoadedWorld & { driver: ReplayDriver; controller: LiveController; manifest: ClipManifest; requested: number };

function requestedTick(manifest: ClipManifest): { k: number; paused: boolean } {
  const params = new URLSearchParams(window.location.search);
  const t = Number(params.get('t'));
  const sessionTick = Number.isFinite(t) && params.has('t') ? Math.round(t) : 1;
  return { k: manifest.anchor.kOffset + sessionTick, paused: params.has('paused') };
}

function writeUrl(manifest: ClipManifest, k: number, paused: boolean): void {
  const url = new URL(window.location.href);
  url.searchParams.set('t', String(k - manifest.anchor.kOffset));
  if (paused) url.searchParams.set('paused', '');
  else url.searchParams.delete('paused');
  window.history.replaceState(window.history.state, '', url.toString().replace('paused=', 'paused'));
}

/**
 * A recorded clip in the 3D world: loads the clip's manifest, the game cache and the renderer's
 * workers, plays the clip through the live layer, and follows the record account.
 */
export function Replay({ clip }: { clip: ReplayClip }) {
  const [ready, setReady] = useState<Ready>();
  const [progress, setProgress] = useState<DownloadProgress>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const abort = new AbortController();
    let loaded: LoadedWorld | undefined;
    (async () => {
      const manifest = await fetchManifest(clip.base);
      await Promise.all(OVERLAY_FONTS.map((font) => document.fonts.load(font)));
      loaded = await loadWorld(abort.signal, setProgress);
      const driver = new ReplayDriver(manifest, (i) => fetchChunk(clip.base, manifest.chunks[i]!));
      const controller = loaded.viewer.startLive(driver.feed);
      driver.bind(controller);
      const { k, paused } = requestedTick(manifest);
      await driver.seek(k);
      if (abort.signal.aborted) return;
      controller.setPendingFollow(manifest.follow.name);
      if (!paused) driver.play();
      setReady({ ...loaded, driver, controller, manifest, requested: k });
    })().catch((e: unknown) => {
      if (abort.signal.aborted) return;
      console.error(e);
      setError(e instanceof WorldLoadError ? e.message : 'The replay failed to load');
    });
    return () => {
      abort.abort();
      loaded?.viewer.dispose();
    };
  }, [clip]);

  if (error) {
    return (
      <div className={styles.pane}>
        <p role="alert" className={styles.message}>{error}</p>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className={styles.pane}>
        <p className={styles.message}>
          {progress ? (
            <span className={styles.progress}>
              Loading the game cache, {fmtInt(Math.round(progress.current / 1024))} of {fmtInt(Math.round(progress.total / 1024))} KB
            </span>
          ) : (
            'Loading the replay'
          )}
        </p>
      </div>
    );
  }
  return <ReplayStage clip={clip} {...ready} />;
}

function ReplayStage({ clip, viewer, pool, driver, controller, manifest, requested }: Ready & { clip: ReplayClip }) {
  const state = useSyncExternalStore(driver.subscribe, driver.getSnapshot);
  const overlayHost = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const renderer = viewer.renderer as WebGLMapViewerRenderer;

  useEffect(() => {
    const canvas = renderer.liveOverlay.canvas;
    overlayHost.current?.appendChild(canvas);
    return () => canvas.remove();
  }, [renderer]);

  const seek = useCallback(
    (k: number) => {
      driver.pause();
      void driver.seek(k).then((done) => done && writeUrl(manifest, driver.getSnapshot().k, true));
    },
    [driver, manifest],
  );
  const play = useCallback(() => {
    driver.play();
    writeUrl(manifest, driver.getSnapshot().k, false);
  }, [driver, manifest]);
  const pause = useCallback(() => {
    driver.pause();
    writeUrl(manifest, driver.getSnapshot().k, true);
  }, [driver, manifest]);
  const speed = useCallback((s: ReplaySpeed) => driver.setSpeed(s), [driver]);

  // Space plays and pauses; arrows step a tick, or 50 with Shift. The canvas keeps its own
  // arrow keys, which orbit the camera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLCanvasElement || target?.closest('input, textarea, select')) return;
      const s = driver.getSnapshot();
      if (e.key === ' ') {
        e.preventDefault();
        if (s.paused) play();
        else pause();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = (e.shiftKey ? 50 : 1) * (e.key === 'ArrowLeft' ? -1 : 1);
        seek(s.k + step);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [driver, play, pause, seek]);

  // Ready for a screenshot: at the requested tick, the followed account drawn, and no map
  // squares or entity bakes outstanding, for three checks in a row.
  useEffect(() => {
    let streak = 0;
    const timer = setInterval(() => {
      const s = driver.getSnapshot();
      const followed = controller.getFollowed();
      const live = renderer.liveRenderer;
      const settled =
        !s.loading &&
        (!s.paused || s.k >= requested) &&
        !!followed &&
        !!live &&
        live.lastDrawn.has(followed) &&
        live.pendingBakes === 0 &&
        renderer.mapManager.loadingMapIds.size === 0 &&
        pool.pendingTasks === 0;
      streak = settled ? streak + 1 : 0;
      if (streak >= 3) host.current?.setAttribute('data-replay-ready', '');
    }, 250);
    return () => clearInterval(timer);
  }, [driver, controller, renderer, pool, requested]);

  return (
    <div className={styles.replay} ref={host} data-replay={clip.id}>
      <div className={styles.stage}>
        <div className={styles.pane}>
          <RendererCanvas renderer={viewer.renderer} />
          <div ref={overlayHost} className={styles.overlay} />
        </div>
        <Timeline manifest={manifest} state={state} marks={clip.marks} onSeek={seek} onPlay={play} onPause={pause} onSpeed={speed} />
      </div>
      <RosterPicker viewer={viewer} controller={controller} recordName={manifest.follow.name} />
    </div>
  );
}
