import { FeedHello, FeedRoster, FeedTick } from "./protocol";

export type FeedStatus = "connecting" | "open" | "closed";

// What a feed delivers to LiveController, already gated (see FeedGate). Each connection epoch
// fires onEpoch before its hello; the hello's tick length resets the world's cadence.
export type FeedHandlers = {
    onEpoch(tickMs?: number): void;
    onHello(hello: FeedHello): void;
    onTick(tick: FeedTick): void;
    onRoster(roster: FeedRoster): void;
    onStatus(status: FeedStatus, error?: string): void;
};

// Where frames come from: rs-dash's socket, or a recorded clip.
export interface FeedSource {
    connect(): void;
    close(): void;
    reconnect(): void;
    setRoster(on: boolean): void;
    setArea(x: number, z: number, w: number, h: number): void;
}

export type FeedFactory = (handlers: FeedHandlers, expectedRevision?: number) => FeedSource;

// Advances the simulation by the client cycles that elapsed on the wall clock. The live feed
// applies frames as they arrive and just cycles; a replay applies each frame at its own cycle,
// interleaved with cycle(), and may run faster or slower than the wall.
export interface WorldStepper {
    step(wallCycles: number): void;
}
