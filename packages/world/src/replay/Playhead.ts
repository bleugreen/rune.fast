import { FeedGateState, INITIAL_GATE, gateFrame } from "../live/FeedGate";
import { FeedHandlers } from "../live/FeedSource";
import { LiveWorld } from "../live/LiveWorld";
import { Checkpoint, ReplayFrame, frameCycle } from "./clip";

// Frames in clip order behind a cursor.
export interface FrameSource {
    // The frame at the cursor: undefined past the last frame, null while it is not loaded yet.
    peek(): ReplayFrame | null | undefined;
    // Moves past the frame peek returned.
    advance(): void;
    // Index of the frame at the cursor, from the first frame of the clip.
    readonly position: number;
    seek(position: number): void;
}

export type StepResult = "ok" | "stalled" | "end";

// Plays recorded frames into a LiveWorld at their own cycles. The live socket applied a frame
// whenever it arrived and cycled on the wall clock; here a frame received `recv` ms after its
// epoch's hello is applied at cycle floor((recv - helloRecv) / 20), after the frames before it
// and before that cycle runs. The result depends only on the frames, so a clip played straight
// through and one restored from a checkpoint end in the same state.
export class Playhead {
    gate: FeedGateState = INITIAL_GATE;
    epochRecv0: number | null = null;
    // recv of the last frame applied.
    lastRecv: number | null = null;

    constructor(
        readonly world: LiveWorld,
        readonly handlers: FeedHandlers,
        public source: FrameSource,
    ) {}

    // Applies every frame due at or before the current cycle. Stops at a frame that is not loaded,
    // which is only ever at a chunk boundary, itself a cycle boundary.
    applyDue(): StepResult {
        for (;;) {
            const frame = this.source.peek();
            if (frame === null) return "stalled";
            if (frame === undefined) return "end";
            if (
                this.epochRecv0 !== null &&
                frameCycle(frame.recv, this.epochRecv0) > this.world.loopCycle
            ) {
                return "ok";
            }
            this.source.advance();
            this.apply(frame);
        }
    }

    // One client cycle, from one canonical point to the next.
    step(): StepResult {
        const next = this.source.peek();
        if (next === null) return "stalled";
        if (next === undefined) return "end";
        this.world.cycle();
        const result = this.applyDue();
        return result === "end" ? "ok" : result === "stalled" ? "ok" : result;
    }

    checkpoint(): Checkpoint {
        return {
            frameIndex: this.source.position,
            epochRecv0: this.epochRecv0,
            gate: { ...this.gate },
            world: this.world.snapshot(),
        };
    }

    restore(checkpoint: Checkpoint): void {
        this.world.restore(checkpoint.world);
        this.gate = { ...checkpoint.gate };
        this.epochRecv0 = checkpoint.epochRecv0;
        this.lastRecv = null;
        this.source.seek(checkpoint.frameIndex);
    }

    private apply(frame: ReplayFrame): void {
        const { state, verdict } = gateFrame(this.gate, frame.msg);
        this.gate = state;
        this.lastRecv = frame.recv;
        const msg = frame.msg;
        switch (verdict) {
            case "epoch":
                if (msg.t !== "hello") return;
                this.epochRecv0 = frame.recv;
                this.handlers.onEpoch(msg.tickMs);
                this.handlers.onHello(msg);
                return;
            case "tick":
                if (msg.t === "tick") this.handlers.onTick(msg);
                return;
            case "roster":
                if (msg.t === "roster") this.handlers.onRoster(msg);
                return;
            case "drop":
                return;
        }
    }
}

// A source over frames already in memory.
export class ArrayFrameSource implements FrameSource {
    position: number;

    constructor(
        readonly frames: readonly ReplayFrame[],
        // Clip index of frames[0].
        readonly offset = 0,
    ) {
        this.position = offset;
    }

    peek(): ReplayFrame | undefined {
        return this.frames[this.position - this.offset];
    }

    advance(): void {
        this.position++;
    }

    seek(position: number): void {
        this.position = position;
    }
}
