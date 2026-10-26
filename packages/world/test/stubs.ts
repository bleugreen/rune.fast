import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FeedHandlers, FeedSource } from "../src/live/FeedSource";
import { LiveController } from "../src/live/LiveController";
import { ReplayFrame, parseRecordedLine } from "../src/replay/clip";

// Cache-free loaders with enough shape for the simulation: every NPC type is one tile, every
// third type idles on a looping four-frame sequence, and every sequence has four 3-cycle frames.
export const npcTypeLoader = {
    load(id: number) {
        return {
            id,
            name: "npc" + id,
            combatLevel: 1,
            size: 1,
            rotationSpeed: 32,
            idleSeqId: id % 3 === 0 ? 7 : -1,
            walkSeqId: -1,
            walkBackSeqId: -1,
            walkLeftSeqId: -1,
            walkRightSeqId: -1,
        };
    },
} as never;

export const seqTypeLoader = {
    load(id: number) {
        return {
            id,
            frameIds: [0, 1, 2, 3],
            frameStep: 4,
            maxLoops: 99,
            replyMode: 0,
            forcedPriority: id % 10,
            precedenceAnimating: -1,
            priority: -1,
            masks: undefined,
            getFrameLength: () => 3,
        };
    },
} as never;

export const seqFrameLoader = {} as never;

export const nullFeed: FeedSource = {
    connect() {},
    close() {},
    reconnect() {},
    setRoster() {},
    setArea() {},
};

// A controller on the stub loaders, with the handlers its feed was given.
export function stubController(): { controller: LiveController; handlers: FeedHandlers } {
    let handlers: FeedHandlers | undefined;
    const controller = new LiveController(
        (h) => {
            handlers = h;
            return nullFeed;
        },
        npcTypeLoader,
        seqTypeLoader,
        seqFrameLoader,
        undefined,
        289,
    );
    return { controller, handlers: handlers! };
}

export const FIXTURE = join(import.meta.dir, "fixtures", "feed-sample.jsonl");

// The fixture's frames in order (its `sent` lines dropped).
export function fixtureFrames(): ReplayFrame[] {
    const frames: ReplayFrame[] = [];
    for (const line of readFileSync(FIXTURE, "utf8").split("\n")) {
        if (!line) continue;
        const parsed = parseRecordedLine(line, 289);
        if ("msg" in parsed) frames.push(parsed);
    }
    return frames;
}
