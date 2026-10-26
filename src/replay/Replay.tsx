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
import { CodePane } from './CodePane';
import { FINISH_BASE, type Moment } from './moments';
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

type Ready = LoadedWorld & { driver: ReplayDriver; controller: LiveController; manifest: ClipManifest; requested: number };

/** A moment's window as feed ticks. */
function windowOf(manifest: ClipManifest, moment: Moment): { kFrom: number; kTo: number } {
  return { kFrom: manifest.anchor.kOffset + moment.from, kTo: manifest.anchor.kOffset + moment.to };
}

function requestedTick(manifest: ClipManifest, moment: Moment): { k: number; paused: boolean } {
  const params = new URLSearchParams(window.location.search);
  const t = Number(params.get('t'));
  const sessionTick = Number.isFinite(t) && params.has('t') ? Math.round(t) : moment.from;
  const clamped = Math.min(Math.max(sessionTick, moment.from), moment.to);
  return { k: manifest.anchor.kOffset + clamped, paused: params.has('paused') };
}

function writeUrl(manifest: ClipManifest, k: number, paused: boolean): void {
  const url = new URL(window.location.href);
  url.searchParams.set('t', String(k - manifest.anchor.kOffset));
  if (paused) url.searchParams.set('paused', '');
  else url.searchParams.delete('paused');
  window.history.replaceState(window.history.state, '', url.toString().replace('paused=', 'paused'));
}

/**
 * A moment of the finish recording in the 3D world: loads the clip's manifest, the game cache and
 * the renderer's workers, opens at the moment's first tick following the record account, and plays
 * the window beside the code each step ran.
 */
export function Replay({ moment }: { moment: Moment }) {
  const [ready, setReady] = useState<Ready>();
  const [progress, setProgress] = useState<DownloadProgress>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const abort = new AbortController();
    let loaded: LoadedWorld | undefined;
    (async () => {
      // Stage marks (User Timing) for scripts/world/shoot.ts --timings.
      performance.mark('replay:start');
      const manifest = await fetchManifest(FINISH_BASE);
      performance.mark('replay:manifest');
      await Promise.all(OVERLAY_FONTS.map((font) => document.fonts.load(font)));
      performance.mark('replay:fonts');
      loaded = await loadWorld(abort.signal, setProgress);
      const driver = new ReplayDriver(manifest, (i) => fetchChunk(FINISH_BASE, manifest.chunks[i]!));
      const controller = loaded.viewer.startLive(driver.feed);
      // Only the followed account is named; everyone else stays unlabelled.
      controller.options.showPlayerNames = false;
      driver.bind(controller);
      const { k, paused } = requestedTick(manifest, moment);
      await driver.seek(k);
      performance.mark('replay:seeked');
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
  }, [moment]);

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
  return <ReplayStage moment={moment} {...ready} />;
}

function ReplayStage({ moment, viewer, pool, driver, controller, manifest, requested }: Ready & { moment: Moment }) {
  const { kFrom, kTo } = windowOf(manifest, moment);
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
      const target = Math.min(Math.max(k, kFrom), kTo);
      void driver.seek(target).then((done) => done && writeUrl(manifest, driver.getSnapshot().k, true));
    },
    [driver, manifest, kFrom, kTo],
  );
  // Play from the moment's start once its end is reached.
  const play = useCallback(() => {
    const start = () => {
      driver.play();
      writeUrl(manifest, driver.getSnapshot().k, false);
    };
    if (driver.getSnapshot().k >= kTo) void driver.seek(kFrom).then((done) => done && start());
    else start();
  }, [driver, manifest, kFrom, kTo]);
  const pause = useCallback(() => {
    driver.pause();
    writeUrl(manifest, driver.getSnapshot().k, true);
  }, [driver, manifest]);
  const speed = useCallback((s: ReplaySpeed) => driver.setSpeed(s), [driver]);

  // A moment stops at its end.
  useEffect(() => {
    if (!state.paused && state.k >= kTo) {
      driver.pause();
      writeUrl(manifest, state.k, true);
    }
  }, [state, driver, manifest, kTo]);

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
      mark('renderer-ready', !!renderer.mainProgram);
      mark('first-frame', renderer.stats.frameCount > 0 && !!renderer.mainProgram);
      mark('maps-loaded', renderer.mapManager.mapSquares.size > 0 && renderer.mapManager.loadingMapIds.size === 0 && pool.pendingTasks === 0);
      mark('followed-drawn', !!followed && !!live && live.lastDrawn.has(followed));
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
      mark('settled', streak === 1);
      if (streak >= 3) {
        mark('ready', true);
        host.current?.setAttribute('data-replay-ready', '');
      }
    }, 250);
    return () => clearInterval(timer);
  }, [driver, controller, renderer, pool, requested]);

  return (
    <div className={styles.replay} ref={host} data-replay={moment.id}>
      <div className={styles.stage}>
        <div className={styles.pane}>
          <RendererCanvas renderer={viewer.renderer} />
          <div ref={overlayHost} className={styles.overlay} />
        </div>
        <Timeline
          manifest={manifest}
          range={{ kStart: kFrom, kEnd: kTo }}
          state={state}
          marks={moment.marks}
          onSeek={seek}
          onPlay={play}
          onPause={pause}
          onSpeed={speed}
        />
        <RecordFollow viewer={viewer} controller={controller} recordName={manifest.follow.name} />
      </div>
      <CodePane moment={moment} sessionTick={state.sessionTick} />
      {import.meta.env.DEV && <DevStatus controller={controller} viewer={viewer} />}
    </div>
  );
}

/**
 * Moving the camera yourself (WASD, panning) stops following; this brings it back. Rotating
 * orbits the account and keeps the follow.
 */
function RecordFollow({ viewer, controller, recordName }: Pick<Ready, 'controller' | 'viewer'> & { recordName: string }) {
  const [following, setFollowing] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => setFollowing(controller.isFollowing() || controller.pendingFollow !== undefined), 500);
    return () => clearInterval(timer);
  }, [controller]);
  if (following) return null;
  return (
    <button type="button" className={styles.back} onClick={() => controller.goToPlayer(recordName, viewer.camera)}>
      Back to the record account
    </button>
  );
}

/** Dev only: the live controller's state, readable as page text. */
function DevStatus({ controller, viewer }: Pick<Ready, 'controller' | 'viewer'>) {
  const [text, setText] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      const w = controller.world;
      const c = viewer.camera;
      setText(
        `dev: tick ${w.tick} cycle ${w.loopCycle} players ${w.players.size} npcs ${w.npcs.size} roster ${w.rosterPlayers.length}@${w.rosterTick} ` +
          `follow ${controller.followName ?? '-'}/${controller.followSlot} pending ${controller.pendingFollow ?? '-'} status ${controller.status} ` +
          `camera ${c.getPosX().toFixed(1)},${c.getPosZ().toFixed(1)} frames ${viewer.renderer.stats.frameCount}`,
      );
    }, 500);
    return () => clearInterval(timer);
  }, [controller, viewer]);
  return <p data-dev-status>{text}</p>;
}
