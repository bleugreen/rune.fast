import { FeedGateState } from "../live/FeedGate";
import { LiveWorldSnapshot } from "../live/LiveWorldSnapshot";
import { FeedMessage, parseFeedFrame } from "../live/protocol";

// A published replay clip: a manifest plus content-hashed JSONL chunks of about a minute each.
// Line 1 of a chunk is the checkpoint the chunk starts from; every other line is one recorded
// feed frame in the recorder's own shape, {"recv":ms,"frame":{...}}, so hourly recordings and
// chunks share one parser. Every frame is gated and redacted before it is written.

export const CLIP_VERSION = 1;

// Client cycles are 20 ms. A frame's cycle counts from the hello that opened its epoch.
export const CYCLE_MS = 20;

export function frameCycle(recv: number, epochRecv0: number): number {
    return Math.floor((recv - epochRecv0) / CYCLE_MS);
}

export type ReplayFrame = { recv: number; msg: FeedMessage };

// The playhead at a canonical point: every frame due at or before the world's loopCycle has been
// applied, and that cycle has not run yet. frameIndex is the next frame to apply, counted from
// the first frame of the clip.
export type Checkpoint = {
    frameIndex: number;
    epochRecv0: number | null;
    gate: FeedGateState;
    world: LiveWorldSnapshot;
};

export type ClipChunk = {
    // First and last tick k in the chunk.
    k0: number;
    k1: number;
    recv0: number;
    recv1: number;
    // Index of the chunk's first frame in the clip, and how many frames it holds.
    f0: number;
    frames: number;
    // loopCycle of the chunk's checkpoint.
    cycle0: number;
    file: string;
    bytes: number;
    sha256: string;
};

export type ClipManifest = {
    v: typeof CLIP_VERSION;
    clip: string;
    revision: number;
    cacheId: string;
    // The account the camera follows, as its roster names it, and its slot in this clip.
    follow: { name: string; slot: number };
    // sessionTick = k - kOffset: the scored session's own tick count, as the timeline numbers it.
    anchor: { kOffset: number };
    window: { kStart: number; kEnd: number; recvStart: number; recvEnd: number };
    // Tick ranges [k0, k1] in which the followed account was outside the recorded area, so the
    // camera has only the roster to go on.
    followGaps: [number, number][];
    // Where the recorder was subscribed, from its `sent` lines.
    subs: { recv: number; x: number; z: number; w: number; h: number }[];
    chunks: ClipChunk[];
    // Counts only, never names.
    redaction: RedactionReport;
};

export type RedactionReport = {
    rosterNamesReplaced: number;
    appearanceNamesReplaced: number;
    playerTextDropped: number;
    npcTextDropped: number;
    namesScanned: number;
    hits: number;
};

export type RecordedLine =
    | { recv: number; msg: FeedMessage }
    | { recv: number; sent: unknown };

// One line of a recording or chunk. Frames are validated by the protocol parser, which throws a
// payload-free error on anything malformed.
export function parseRecordedLine(line: string, revision: number): RecordedLine {
    const value = JSON.parse(line) as { recv?: unknown; frame?: unknown; sent?: unknown };
    if (typeof value.recv !== "number" || !Number.isSafeInteger(value.recv)) {
        throw new Error("Recorded line has no integer recv");
    }
    if ("frame" in value) {
        return { recv: value.recv, msg: parseFeedFrame(JSON.stringify(value.frame), revision) };
    }
    if ("sent" in value) {
        return { recv: value.recv, sent: value.sent };
    }
    throw new Error("Recorded line is neither a frame nor a sent message");
}

export function formatFrameLine(frame: ReplayFrame): string {
    return `{"recv":${frame.recv},"frame":${JSON.stringify(frame.msg)}}`;
}

export function formatCheckpointLine(checkpoint: Checkpoint): string {
    return JSON.stringify({ checkpoint });
}

export type ChunkData = { checkpoint: Checkpoint; frames: ReplayFrame[] };

export function parseChunk(text: string, revision: number): ChunkData {
    const lines = text.split("\n").filter((l) => l.length > 0);
    const head = JSON.parse(lines[0] ?? "null") as { checkpoint?: Checkpoint } | null;
    if (!head?.checkpoint) throw new Error("Chunk does not start with a checkpoint");
    const frames: ReplayFrame[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = parseRecordedLine(lines[i], revision);
        if (!("msg" in line)) throw new Error("Chunk carries a non-frame line");
        frames.push(line);
    }
    return { checkpoint: head.checkpoint, frames };
}
