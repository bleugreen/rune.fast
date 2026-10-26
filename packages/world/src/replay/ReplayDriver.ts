import { FeedHandlers, FeedSource, WorldStepper } from "../live/FeedSource";
import { LiveController } from "../live/LiveController";
import { ChunkData, Checkpoint, ClipManifest, ReplayFrame } from "./clip";
import { FrameSource, Playhead } from "./Playhead";

export type ReplaySpeed = 1 | 4 | 16;

// What the timeline renders, refreshed about ten times a second.
export type ReplayState = {
    k: number;
    sessionTick: number;
    recv: number | null;
    speed: ReplaySpeed;
    paused: boolean;
    // A seek is running, or playback is waiting for the next chunk.
    loading: boolean;
    ended: boolean;
    // Tick ranges of the chunks in memory.
    loaded: [number, number][];
};

// The most replay cycles one rendered frame may run, as the live renderer caps its catch-up.
export const MAX_CYCLES_PER_FRAME = 50;
// In-memory checkpoints are taken every this many ticks while playing.
export const CHECKPOINT_EVERY_TICKS = 50;
const MAX_MEMORY_CHECKPOINTS = 64;
const MAX_LOADED_CHUNKS = 8;
const PREFETCH_FRAMES = 120;
const NOTIFY_MS = 100;

// Clip frames from chunks fetched on demand. Reports a frame as not loaded (null) until its
// chunk has arrived, and asks for it.
class ChunkFrameSource implements FrameSource {
    position = 0;
    private readonly chunks = new Map<number, ChunkData>();
    private readonly pending = new Map<number, Promise<ChunkData>>();
    private readonly total: number;

    constructor(
        readonly manifest: ClipManifest,
        private readonly fetchChunk: (index: number) => Promise<ChunkData>,
        private readonly onLoaded: () => void,
    ) {
        const last = manifest.chunks[manifest.chunks.length - 1];
        this.total = last ? last.f0 + last.frames : 0;
    }

    chunkIndexOf(position: number): number {
        const chunks = this.manifest.chunks;
        let lo = 0;
        let hi = chunks.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (chunks[mid].f0 <= position) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    peek(): ReplayFrame | null | undefined {
        if (this.position >= this.total) return undefined;
        const index = this.chunkIndexOf(this.position);
        const chunk = this.chunks.get(index);
        if (!chunk) {
            void this.load(index);
            return null;
        }
        const local = this.position - this.manifest.chunks[index].f0;
        if (local + PREFETCH_FRAMES >= chunk.frames.length && index + 1 < this.manifest.chunks.length) {
            void this.load(index + 1);
        }
        return chunk.frames[local];
    }

    advance(): void {
        this.position++;
    }

    seek(position: number): void {
        this.position = position;
    }

    get(index: number): ChunkData | undefined {
        return this.chunks.get(index);
    }

    load(index: number): Promise<ChunkData> {
        const loaded = this.chunks.get(index);
        if (loaded) return Promise.resolve(loaded);
        let pending = this.pending.get(index);
        if (!pending) {
            pending = this.fetchChunk(index).then(
                (data) => {
                    this.pending.delete(index);
                    this.chunks.set(index, data);
                    this.evict(index);
                    this.onLoaded();
                    return data;
                },
                (error: unknown) => {
                    this.pending.delete(index);
                    throw error;
                },
            );
            this.pending.set(index, pending);
        }
        return pending;
    }

    // Keeps the chunks nearest the one just loaded.
    private evict(around: number): void {
        if (this.chunks.size <= MAX_LOADED_CHUNKS) return;
        const current = this.chunkIndexOf(this.position);
        const far = [...this.chunks.keys()]
            .filter((i) => i !== around && i !== current)
            .sort((a, b) => Math.abs(b - current) - Math.abs(a - current));
        for (const i of far.slice(0, this.chunks.size - MAX_LOADED_CHUNKS)) this.chunks.delete(i);
    }

    loadedIndexes(): number[] {
        return [...this.chunks.keys()].sort((a, b) => a - b);
    }
}

// Plays a published clip into a LiveController: it is the controller's feed (frames arrive
// through the same handlers a socket would use) and its stepper (each rendered frame runs
// speed x elapsed cycles of the clip). Seeking restores the nearest checkpoint at or before the
// target, from memory or the target chunk's own, and plays forward to it.
export class ReplayDriver implements FeedSource, WorldStepper {
    private speed: ReplaySpeed = 1;
    private paused = true;
    private ended = false;
    private seeking = 0;
    private stalled = false;

    private handlers?: FeedHandlers;
    private controller?: LiveController;
    private playhead?: Playhead;
    private readonly source: ChunkFrameSource;
    // Sorted by frameIndex.
    private checkpoints: Checkpoint[] = [];
    private nextCheckpointTick = 0;

    private listeners = new Set<() => void>();
    private state: ReplayState;
    private lastNotify = 0;

    constructor(
        readonly manifest: ClipManifest,
        fetchChunk: (index: number) => Promise<ChunkData>,
    ) {
        this.source = new ChunkFrameSource(manifest, fetchChunk, () => {
            this.stalled = false;
            this.notify(true);
        });
        this.state = this.computeState();
    }

    // The FeedFactory to start the controller with: MapViewer.startLive(driver.feed).
    readonly feed = (handlers: FeedHandlers): FeedSource => {
        this.handlers = handlers;
        return this;
    };

    // Takes over the controller's stepping. Call once, after startLive.
    bind(controller: LiveController): void {
        if (!this.handlers) throw new Error("ReplayDriver.feed was not used to start this controller");
        this.controller = controller;
        controller.stepper = this;
        this.playhead = new Playhead(controller.world, this.handlers, this.source);
    }

    // FeedSource: a clip has no connection or subscriptions; the recorded frames already
    // reflect the area the recorder was subscribed to.
    connect(): void {
        this.handlers?.onStatus("open");
    }
    close(): void {
        this.paused = true;
        this.seeking++;
        this.handlers?.onStatus("closed");
    }
    reconnect(): void {}
    setRoster(): void {}
    setArea(): void {}

    // WorldStepper: called by the renderer every frame with the wall-clock cycles that elapsed.
    step(wallCycles: number): void {
        if (this.paused || this.seeking > 0 || !this.playhead) return;
        const cycles = Math.min(MAX_CYCLES_PER_FRAME, wallCycles * this.speed);
        this.run(cycles);
        this.notify(false);
    }

    // Runs up to `cycles` replay cycles; returns how many ran.
    private run(cycles: number): number {
        const playhead = this.playhead!;
        let ran = 0;
        while (ran < cycles) {
            const result = playhead.step();
            if (result === "stalled") {
                this.stalled = true;
                break;
            }
            if (result === "end") {
                this.ended = true;
                this.paused = true;
                break;
            }
            ran++;
            this.maybeCheckpoint();
        }
        return ran;
    }

    private maybeCheckpoint(): void {
        const world = this.playhead!.world;
        if (world.tick < this.nextCheckpointTick) return;
        this.nextCheckpointTick =
            (Math.floor(world.tick / CHECKPOINT_EVERY_TICKS) + 1) * CHECKPOINT_EVERY_TICKS;
        const checkpoint = this.playhead!.checkpoint();
        const at = this.checkpoints.findIndex((c) => c.frameIndex >= checkpoint.frameIndex);
        if (at === -1) this.checkpoints.push(checkpoint);
        else if (this.checkpoints[at].frameIndex !== checkpoint.frameIndex) this.checkpoints.splice(at, 0, checkpoint);
        if (this.checkpoints.length > MAX_MEMORY_CHECKPOINTS) {
            // Drop the one farthest from the playhead.
            const here = checkpoint.frameIndex;
            let worst = 0;
            for (let i = 1; i < this.checkpoints.length; i++) {
                if (Math.abs(this.checkpoints[i].frameIndex - here) > Math.abs(this.checkpoints[worst].frameIndex - here)) worst = i;
            }
            this.checkpoints.splice(worst, 1);
        }
    }

    play(): void {
        if (this.ended) return;
        this.paused = false;
        this.notify(true);
    }

    pause(): void {
        this.paused = true;
        this.notify(true);
    }

    setSpeed(speed: ReplaySpeed): void {
        this.speed = speed;
        this.notify(true);
    }

    // Positions the replay just after tick k was applied: k's cycle, before that cycle runs.
    // Ticks outside the clip are clamped to it. Resolves false if a later seek superseded this one.
    async seek(k: number): Promise<boolean> {
        const playhead = this.playhead;
        if (!playhead) throw new Error("ReplayDriver is not bound");
        const token = ++this.seeking;
        this.notify(true);
        try {
            const chunks = this.manifest.chunks;
            const target = Math.min(Math.max(k, this.manifest.window.kStart), this.manifest.window.kEnd);
            let index = chunks.findIndex((c) => c.k1 >= target);
            if (index === -1) index = chunks.length - 1;
            const chunk = await this.source.load(index);
            if (token !== this.seeking) return false;
            let local = chunk.frames.findIndex((f) => f.msg.t === "tick" && f.msg.k >= target);
            if (local === -1) local = chunk.frames.length - 1;
            const targetIndex = chunks[index].f0 + local;

            // Start from the latest checkpoint at or before the target within this chunk, or
            // carry on from where the playhead is when that is closer.
            const floor = chunks[index].f0;
            let base: Checkpoint = chunk.checkpoint;
            for (const c of this.checkpoints) {
                if (c.frameIndex <= targetIndex && c.frameIndex >= floor && c.frameIndex > base.frameIndex) base = c;
            }
            const here = this.source.position;
            if (!(here <= targetIndex && here >= base.frameIndex)) {
                playhead.restore(base);
            }
            this.ended = false;
            this.nextCheckpointTick = playhead.world.tick + 1;
            while (this.source.position <= targetIndex) {
                const result = playhead.step();
                if (result === "end") break;
                if (result === "stalled") {
                    await this.source.load(this.source.chunkIndexOf(this.source.position));
                    if (token !== this.seeking) return false;
                    continue;
                }
                this.maybeCheckpoint();
            }
            this.controller?.rebase({ keepFollow: true });
            return true;
        } finally {
            if (token === this.seeking) this.seeking = 0;
            this.notify(true);
        }
    }

    // useSyncExternalStore
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = (): ReplayState => this.state;

    private notify(force: boolean): void {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (!force && now - this.lastNotify < NOTIFY_MS) return;
        this.lastNotify = now;
        this.state = this.computeState();
        for (const listener of this.listeners) listener();
    }

    private computeState(): ReplayState {
        const world = this.playhead?.world;
        const k = world && world.tick >= 0 ? world.tick : this.manifest.window.kStart;
        return {
            k,
            sessionTick: k - this.manifest.anchor.kOffset,
            recv: this.playhead?.lastRecv ?? null,
            speed: this.speed,
            paused: this.paused,
            loading: this.seeking > 0 || (this.stalled && !this.paused),
            ended: this.ended,
            loaded: this.source
                .loadedIndexes()
                .map((i) => [this.manifest.chunks[i].k0, this.manifest.chunks[i].k1]),
        };
    }
}
