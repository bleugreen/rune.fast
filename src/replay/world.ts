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
let tenant: { ticket: Ticket; host: HTMLElement; overlay: HTMLElement; evict: () => void } | undefined;
const manifests = new Map<string, Promise<ClipManifest>>();
const drivers = new Map<string, ReplayDriver>();

function startWorkers(): RenderDataWorkerPool {
  if (!WebGLMapViewerRenderer.isSupported()) throw new WorldLoadError('This browser has no WebGL2');
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
      const cache = await loadCache();
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
 * the record account, paused; it rejects with Superseded if another embed asks first.
 */
export function acquire(entry: ReplayEntry, host: HTMLElement, overlay: HTMLElement, evict: () => void): Ticket {
  const previous = tenant;
  const ticket: Ticket = {
    entry,
    ready: (async () => {
      const [w, manifest] = await Promise.all([world(), manifestOf(entry.recording)]);
      if (tenant?.ticket !== ticket) throw new Superseded();
      const { viewer, renderer } = w;
      const driver = driverFor(entry, manifest);
      // A fresh controller around the same viewer: the map squares, textures and models stay.
      const controller = viewer.startLive(driver.feed);
      // Only the followed account is named; everyone else stays unlabelled.
      controller.options.showPlayerNames = false;
      driver.bind(controller);
      host.appendChild(renderer.canvas);
      overlay.appendChild(renderer.liveOverlay.canvas);
      rendererStarted ??= renderer.init();
      await rendererStarted;
      const kFrom = manifest.anchor.kOffset + entry.from;
      await driver.seek(kFrom);
      performance.mark('replay:seeked');
      if (tenant?.ticket !== ticket) throw new Superseded();
      controller.setPendingFollow(manifest.follow.name);
      renderer.start();
      return { ...w, driver, controller, kFrom, kTo: manifest.anchor.kOffset + entry.to };
    })(),
  };
  tenant = { ticket, host, overlay, evict };
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
