import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  OVERLAY_FONTS,
  RendererCanvas,
  WorldLoadError,
  type LiveController,
  type RenderDataWorkerPool,
  type WebGLMapViewerRenderer,
} from '@rune/world';
import { parseChunk, type ChunkData, type ClipChunk, type ClipManifest } from '@rune/world/replay/clip';
import { ReplayDriver } from '@rune/world/replay/ReplayDriver';
import type { MediaHandle, MediaProps } from '../clips/Clip';
import { TICK_MS, type ReplayEntry } from '../clips/registry';
import { WORLD_ASSET_BASE } from './assets';
import { loadWorld, startWorkers, type LoadedWorld } from './world';
import styles from './Replay.module.css';

const REVISION = 289;

/** If the scene never settles (the account out of the recorded area), show it anyway after this long. */
const SHOW_AFTER_MS = 3000;

async function fetchManifest(base: string): Promise<ClipManifest> {
  const resp = await fetch(base + 'manifest.json');
  if (!resp.ok) throw new WorldLoadError('The replay is unavailable');
  const manifest = (await resp.json()) as ClipManifest;
  if (manifest.v !== 1 || manifest.revision !== REVISION) throw new WorldLoadError('The replay was made for a different version');
  return manifest;
}

async function fetchChunk(base: string, chunk: ClipChunk): Promise<ChunkData> {
  performance.mark(`replay:chunk-requested ${chunk.file}`);
  const resp = await fetch(base + chunk.file);
  if (!resp.ok) throw new Error(`Replay chunk ${chunk.file}: HTTP ${resp.status}`);
  const text = await resp.text();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== chunk.sha256) throw new Error(`Replay chunk ${chunk.file} failed its checksum`);
  performance.mark(`replay:chunk-fetched ${chunk.file}`);
  const data = parseChunk(text, REVISION);
  performance.mark(`replay:chunk-parsed ${chunk.file}`);
  return data;
}

type Ready = LoadedWorld & { driver: ReplayDriver; controller: LiveController; kFrom: number; kTo: number };

/**
 * A window of a published world-feed recording in the 3D world, as the footage inside a clip
 * frame: loads the manifest, the renderer's workers and the game cache (the one shared download),
 * opens at the window's first tick following the record account, and plays to its last. The
 * reader cannot move the camera: the layer takes no input, so the frame's own controls are the
 * only ones. Only the record account is named in the scene.
 */
const Replay = forwardRef<MediaHandle, MediaProps<ReplayEntry>>(function Replay(props, ref) {
  const { entry } = props;
  const [ready, setReady] = useState<Ready>();
  const readyRef = useRef<Ready>();
  readyRef.current = ready;
  const latest = useRef(props);
  latest.current = props;

  useImperativeHandle(ref, () => ({
    seek: (ms) => {
      const r = readyRef.current;
      if (!r) return;
      const k = Math.min(r.kFrom + Math.round(ms / TICK_MS), r.kTo);
      void r.driver.seek(k);
    },
  }));

  useEffect(() => {
    const abort = new AbortController();
    let pool: RenderDataWorkerPool | undefined;
    let loaded: LoadedWorld | undefined;
    const base = `${WORLD_ASSET_BASE}replays/${entry.recording}/`;
    (async () => {
      // Stage marks (User Timing) for scripts/world/shoot.ts --timings and bench-load.ts.
      performance.mark('replay:start');
      // The workers load while the manifest, the fonts and the cache arrive.
      pool = startWorkers();
      const manifest = await fetchManifest(base);
      performance.mark('replay:manifest');
      await Promise.all(OVERLAY_FONTS.map((font) => document.fonts.load(font)));
      performance.mark('replay:fonts');
      loaded = await loadWorld(pool, abort.signal, () => {});
      const driver = new ReplayDriver(manifest, (i) => fetchChunk(base, manifest.chunks[i]!));
      const controller = loaded.viewer.startLive(driver.feed);
      // Only the followed account is named; everyone else stays unlabelled.
      controller.options.showPlayerNames = false;
      driver.bind(controller);
      const kFrom = manifest.anchor.kOffset + entry.from;
      await driver.seek(kFrom);
      performance.mark('replay:seeked');
      if (abort.signal.aborted) return;
      controller.setPendingFollow(manifest.follow.name);
      setReady({ ...loaded, driver, controller, kFrom, kTo: manifest.anchor.kOffset + entry.to });
    })().catch((e: unknown) => {
      if (abort.signal.aborted) return;
      console.error(e);
      latest.current.onFailed(e instanceof WorldLoadError ? e.message : 'The replay failed to load');
    });
    return () => {
      abort.abort();
      loaded?.viewer.dispose();
      void pool?.terminate();
    };
    // The frame's callbacks are read through `latest`: they are new closures on every render.
  }, [entry]);

  return (
    <div
      className={styles.media}
      data-replay={entry.id}
      ref={(el) => {
        // No pointer, key or focus reaches the renderer's canvas, so its camera controls never engage.
        if (el) el.inert = true;
      }}
    >
      {ready && <Stage ready={ready} latest={latest} />}
    </div>
  );
});

export default Replay;

function Stage({ ready, latest }: { ready: Ready; latest: { current: MediaProps<ReplayEntry> } }) {
  const { viewer, pool, driver, controller, kFrom, kTo } = ready;
  const renderer = viewer.renderer as WebGLMapViewerRenderer;
  const overlayHost = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  /** Held at the first tick under the poster until the scene is drawn, so the reader sees the window from its start. */
  const [shown, setShown] = useState(false);
  const playing = latest.current.playing;

  useEffect(() => {
    const canvas = renderer.liveOverlay.canvas;
    overlayHost.current?.appendChild(canvas);
    return () => canvas.remove();
  }, [renderer]);

  // Play and pause as the frame asks, once the scene is shown; from the end, play from the start.
  useEffect(() => {
    if (!shown) return;
    if (!playing) {
      driver.pause();
      return;
    }
    if (driver.getSnapshot().k >= kTo) void driver.seek(kFrom).then((done) => done && driver.play());
    else driver.play();
  }, [shown, playing, driver, kFrom, kTo]);

  // Report the playhead, between ticks too, so the frame's rule moves smoothly; stop at the window's end.
  useEffect(() => {
    let raf = 0;
    let tick = -1;
    let tickAt = 0;
    const follow = () => {
      const s = driver.getSnapshot();
      const now = performance.now();
      if (s.k !== tick) {
        tick = s.k;
        tickAt = now;
      }
      const moving = !s.paused && !s.loading;
      const ms = (Math.min(s.k, kTo) - kFrom) * TICK_MS + (moving ? Math.min(now - tickAt, TICK_MS) : 0);
      latest.current.onTime(Math.max(0, Math.min(ms, (kTo - kFrom) * TICK_MS)));
      if (!s.paused && s.k >= kTo) {
        driver.pause();
        latest.current.onEnded();
        return;
      }
      if (moving) latest.current.onPlaying();
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [driver, kFrom, kTo, latest]);

  // Shown once the followed account is drawn with no map squares or entity bakes outstanding.
  // Ready for a screenshot when that has held for eight checks in a row (0.8 s); the attribute
  // goes again while anything is outstanding, as after a seek.
  useEffect(() => {
    let streak = 0;
    let firstFrameAt: number | undefined;
    const once = new Set<string>();
    const mark = (name: string, reached: boolean) => {
      if (reached && !once.has(name)) {
        once.add(name);
        performance.mark(`replay:${name}`);
      }
    };
    const timer = setInterval(() => {
      const s = driver.getSnapshot();
      const followed = controller.getFollowed();
      const live = renderer.liveRenderer;
      const firstFrame = renderer.stats.frameCount > 0 && !!renderer.mainProgram;
      if (firstFrame) firstFrameAt ??= performance.now();
      mark('renderer-ready', !!renderer.mainProgram);
      mark('first-frame', firstFrame);
      mark('maps-loaded', renderer.mapManager.mapSquares.size > 0 && renderer.mapManager.loadingMapIds.size === 0 && pool.pendingTasks === 0);
      mark('followed-drawn', !!followed && !!live && live.lastDrawn.has(followed));
      const settled =
        !s.loading &&
        !!followed &&
        !!live &&
        live.lastDrawn.has(followed) &&
        live.pendingBakes === 0 &&
        renderer.mapManager.loadingMapIds.size === 0 &&
        pool.pendingTasks === 0;
      streak = settled ? streak + 1 : 0;
      mark('settled', streak === 1);
      if (streak >= 1 || (firstFrameAt !== undefined && performance.now() - firstFrameAt > SHOW_AFTER_MS)) {
        mark('shown', true);
        setShown(true);
      }
      if (streak >= 8) {
        mark('ready', true);
        host.current?.setAttribute('data-replay-ready', '');
      } else if (streak === 0) host.current?.removeAttribute('data-replay-ready');
    }, 100);
    return () => clearInterval(timer);
  }, [driver, controller, renderer, pool]);

  // Paused before the scene was shown: show it anyway, still, so the frame is not left on its poster.
  useEffect(() => {
    if (shown && !playing) latest.current.onPlaying();
  }, [shown, playing, latest]);

  return (
    <div className={styles.stage} ref={host}>
      <RendererCanvas renderer={viewer.renderer} />
      <div ref={overlayHost} className={styles.overlay} />
    </div>
  );
}
