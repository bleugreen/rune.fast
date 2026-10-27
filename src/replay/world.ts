import {
  MapViewer,
  OVERLAY_FONTS,
  RenderDataWorkerPool,
  WebGLMapViewerRenderer,
  WorldLoadError,
  isSharedMemorySupported,
  type LiveController,
} from '@rune/world';
import { parseChunk, type ChunkData, type ClipChunk, type ClipManifest } from '@rune/world/replay/clip';
import { ReplayDriver } from '@rune/world/replay/ReplayDriver';
import type { ReplayEntry } from '../clips/registry';
import { reloadIfRedeployed } from '../lib/deploy';
import { WORLD_ASSET_BASE } from './assets';
import { loadCache } from './cache';

/*
 * The page's one 3D world. Every replay embed on the page shares it: one worker pool, one loaded
 * cache, one MapViewer (so map squares stay warm from one embed to the next) and one WebGL canvas.
 * Nothing is made until the first replay plays, and nothing is torn down for the page's lifetime.
 * One embed holds the stage at a time; the canvas moves into its frame, and the embed it moved out
 * of is told to go back to its poster. What each embed keeps of its own is its ReplayDriver.
 */

const REVISION = 289;
/** How redaction names an account other than the record one: its roster slot. */
const SLOT_ALIAS = /^slot_\d+$/;
/** Drivers kept for embeds off the stage, so going back to one reuses its fetched chunks and checkpoints. */
const DRIVERS_KEPT = 4;

export type SharedWorld = { viewer: MapViewer; pool: RenderDataWorkerPool; renderer: WebGLMapViewerRenderer };

/** The stage as one embed holds it. */
export type Stage = SharedWorld & { driver: ReplayDriver; controller: LiveController; kFrom: number; kTo: number };

/** An embed's claim on the stage, from asking until it lets go or is moved off. */
export interface Ticket {
  readonly entry: ReplayEntry;
  readonly ready: Promise<Stage>;
}

/** The claim was overtaken by another embed's before it was ready. */
export class Superseded extends Error {}

/** What the page has made, for tests and benchmarks: each count stays at most 1 however many embeds play. */
export const made = { pools: 0, viewers: 0, renderers: 0 };

let shared: Promise<SharedWorld> | undefined;
let rendererStarted: Promise<void> | undefined;
let tenant: { claim: object; ticket: Ticket; evict: () => void } | undefined;
const manifests = new Map<string, Promise<ClipManifest>>();
const drivers = new Map<string, ReplayDriver>();

function startWorkers(): RenderDataWorkerPool {
  if (!WebGLMapViewerRenderer.isSupported()) throw new WorldLoadError('This browser has no WebGL2');
  // The workers and the wasm are named by the build this tab loaded; after a deploy they are gone.
  void reloadIfRedeployed();
  const pool = RenderDataWorkerPool.create(isSharedMemorySupported ? 4 : 1);
  made.pools++;
  performance.mark('replay:workers-started');
  console.info(`[world] crossOriginIsolated=${String(crossOriginIsolated)} workers=${pool.size}`);
  return pool;
}

/**
 * The shared world, made on first call. The render workers start first: four sharing the cache when
 * the page is cross-origin isolated (SharedArrayBuffer), otherwise one given a copy, so their module
 * load and wasm init overlap the cache download. Nothing reaches a worker until the MapViewer hands
 * the pool the cache (it posts `initCache` first, and a worker takes its messages in order).
 */
function world(): Promise<SharedWorld> {
  shared ??= (async () => {
    performance.mark('replay:start');
    const pool = startWorkers();
    try {
      await Promise.all(OVERLAY_FONTS.map((font) => document.fonts.load(font)));
      performance.mark('replay:fonts');
      // Each downloaded part is progress, so a slow connection is not taken for a stalled load.
      const cache = await loadCache(undefined, () => advance(`${progress.phase.split(' (')[0]} (cache download)`));
      performance.mark('replay:cache-fetched');
      const viewer = new MapViewer(pool, cache);
      made.viewers++;
      made.renderers++;
      performance.mark('replay:cache-indexed');
      return { viewer, pool, renderer: viewer.renderer as WebGLMapViewerRenderer };
    } catch (e) {
      void pool.terminate();
      throw e;
    }
  })();
  // A failure is not kept: the next embed played tries again.
  shared.catch(() => (shared = undefined));
  return shared;
}

/** Starts the game-cache download, the one shared one, before any replay asks for the world. */
export function prefetch(): void {
  loadCache().catch((e: unknown) => console.warn('Game cache prefetch failed', e));
}

function manifestOf(recording: string): Promise<ClipManifest> {
  let m = manifests.get(recording);
  if (!m) {
    m = (async () => {
      const resp = await fetch(`${WORLD_ASSET_BASE}replays/${recording}/manifest.json`);
      if (!resp.ok) throw new WorldLoadError('The replay is unavailable');
      const manifest = (await resp.json()) as ClipManifest;
      if (manifest.v !== 1 || manifest.revision !== REVISION) throw new WorldLoadError('The replay was made for a different version');
      performance.mark('replay:manifest');
      return manifest;
    })();
    m.catch(() => manifests.delete(recording));
    manifests.set(recording, m);
  }
  return m;
}

async function fetchChunk(recording: string, chunk: ClipChunk): Promise<ChunkData> {
  performance.mark(`replay:chunk-requested ${chunk.file}`);
  const resp = await fetch(`${WORLD_ASSET_BASE}replays/${recording}/${chunk.file}`);
  if (!resp.ok) throw new Error(`Replay chunk ${chunk.file}: HTTP ${resp.status}`);
  const text = await resp.text();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== chunk.sha256) throw new Error(`Replay chunk ${chunk.file} failed its checksum`);
  performance.mark(`replay:chunk-fetched ${chunk.file}`);
  return parseChunk(text, REVISION);
}

/** The latest claim's load: the step it is on and when it last moved on (performance.now()). */
const progress = { phase: 'idle', at: 0 };

/** How far the latest claim's load has got, and when it last moved on: the embed's stall watchdog reads it. */
export function loadProgress(): { readonly phase: string; readonly at: number } {
  return progress;
}

function advance(phase: string): void {
  progress.phase = phase;
  progress.at = performance.now();
}

/** The last stage handed out, for `window.__replay()` in development. */
const debug: { stage?: Omit<Stage, 'kFrom' | 'kTo'> } = {};

if (import.meta.env.DEV) {
  (window as unknown as { __replay: () => unknown }).__replay = () => {
    const s = debug.stage;
    const followed = s?.controller.getFollowed();
    const live = s?.renderer.liveRenderer;
    return {
      phase: progress.phase,
      tenant: tenant?.ticket.entry.id,
      driver: s?.driver.debugState(),
      follow: s && {
        name: s.controller.followName,
        slot: s.controller.followSlot,
        pending: s.controller.pendingFollow,
        followed: !!followed,
        drawn: !!followed && !!live && live.lastDrawn.has(followed),
        camera: [s.viewer.camera.getPosX(), s.viewer.camera.getPosZ()].map(Math.round),
        player: followed && [followed.x / 128, followed.z / 128].map(Math.round),
        groundY: followed && s.renderer.getLiveGroundY(followed),
      },
      renderer: s && {
        running: s.renderer.running,
        frames: s.renderer.stats.frameCount,
        program: !!s.renderer.mainProgram,
        live: !!live,
        pendingBakes: live?.pendingBakes,
        mapSquares: s.renderer.mapManager.mapSquares.size,
        loadingMaps: s.renderer.mapManager.loadingMapIds.size,
        poolPending: s.pool.pendingTasks,
      },
    };
  };
}

/** The entry's driver, from the kept ones or new; the most recently used last. */
function driverFor(entry: ReplayEntry, manifest: ClipManifest): ReplayDriver {
  let driver = drivers.get(entry.id);
  if (driver) drivers.delete(entry.id);
  else driver = new ReplayDriver(manifest, (i) => fetchChunk(entry.recording, manifest.chunks[i]!));
  drivers.set(entry.id, driver);
  while (drivers.size > DRIVERS_KEPT) drivers.delete(drivers.keys().next().value!);
  return driver;
}

/**
 * Asks for the stage for `entry`, drawn into `host` with its overlay in `overlay`. Whoever holds it
 * is evicted at once. `ready` resolves with the world opened at the window's first tick, following
 * the recording's account (the record account, or another by its slot alias), paused; it rejects with Superseded if another embed asks first.
 */
export function acquire(entry: ReplayEntry, host: HTMLElement, overlay: HTMLElement, evict: () => void): Ticket {
  const previous = tenant;
  // This claim's identity, made before anything is awaited, so a later claim can overtake it.
  const claim = {};
  const holds = () => tenant?.claim === claim;
  const ticket: Ticket = {
    entry,
    ready: (async () => {
      const phase = (name: string) => {
        advance(`${entry.id}: ${name}`);
        performance.mark(`replay:acquire ${entry.id} ${name}`);
      };
      phase('asked');
      const [w, manifest] = await Promise.all([world(), manifestOf(entry.recording)]);
      if (!holds()) throw new Superseded();
      const { viewer, renderer } = w;
      const driver = driverFor(entry, manifest);
      // A fresh controller around the same viewer: the map squares, textures and models stay.
      const controller = viewer.startLive(driver.feed);
      // Only the record account is ever named. Another account is followed by its slot alias
      // ("slot_994"), which names no one, so it stays unlabelled like everyone else.
      controller.options.showPlayerNames = false;
      controller.options.showFollowedName = !SLOT_ALIAS.test(manifest.follow.name);
      driver.bind(controller);
      debug.stage = { ...w, driver, controller };
      host.appendChild(renderer.canvas);
      overlay.appendChild(renderer.liveOverlay.canvas);
      phase('renderer-init');
      if (!rendererStarted) {
        rendererStarted = renderer.init();
        // A failed start is not kept: the next play tries again.
        rendererStarted.catch(() => (rendererStarted = undefined));
      }
      await rendererStarted;
      const kFrom = manifest.anchor.kOffset + entry.from;
      phase('seek');
      await driver.seek(kFrom);
      performance.mark('replay:seeked');
      phase('seeked');
      if (!holds()) throw new Superseded();
      controller.setPendingFollow(manifest.follow.name);
      renderer.start();
      return { ...w, driver, controller, kFrom, kTo: manifest.anchor.kOffset + entry.to };
    })(),
  };
  tenant = { claim, ticket, evict };
  if (previous) {
    drivers.get(previous.ticket.entry.id)?.pause();
    previous.evict();
  }
  return ticket;
}

/** Gives the stage back, if this ticket still holds it: drawing stops and the canvas leaves the frame. */
export function release(ticket: Ticket): void {
  if (tenant?.ticket !== ticket) return;
  tenant = undefined;
  void shared?.then(({ renderer }) => {
    if (tenant) return;
    renderer.suspend();
    renderer.canvas.remove();
    renderer.liveOverlay.canvas.remove();
  });
  drivers.get(ticket.entry.id)?.pause();
}
