import { describe, expect, test } from "bun:test";
import { LiveNpc, LivePlayer } from "../src/live/LiveEntity";
import {
    ENTITY_ARRAY_FIELDS,
    ENTITY_DERIVED_FIELDS,
    ENTITY_NUMBER_FIELDS,
} from "../src/live/LiveWorldSnapshot";
import { Checkpoint, ChunkData, ClipManifest, ReplayFrame, frameCycle } from "../src/replay/clip";
import { cutChunks } from "../src/replay/cut";
import { ArrayFrameSource, Playhead } from "../src/replay/Playhead";
import { MAX_CYCLES_PER_FRAME, ReplayDriver } from "../src/replay/ReplayDriver";
import { fixtureFrames, stubController } from "./stubs";

const frames = fixtureFrames();
const ticks = frames.flatMap((f) => (f.msg.t === "tick" ? [f.msg.k] : []));

function playhead(source = new ArrayFrameSource(frames)) {
    const { controller, handlers } = stubController();
    return { ph: new Playhead(controller.world, handlers, source), controller };
}

function playToEnd(ph: Playhead): void {
    while (ph.step() !== "end");
}

// Plays until the first tick frame at or after k has been applied, finishing its cycle.
function playToTick(ph: Playhead, k: number): void {
    const index = frames.findIndex((f) => f.msg.t === "tick" && f.msg.k >= k);
    while (ph.source.position <= index && ph.step() !== "end");
}

const json = (v: unknown) => JSON.stringify(v);

describe("cycle schedule", () => {
    test("each frame is applied at floor((recv - helloRecv) / 20), in order", () => {
        const { ph } = playhead();
        const applied: [ReplayFrame, number][] = [];
        ph.onFrame = (f) => applied.push([f, ph.world.loopCycle]);
        playToEnd(ph);
        expect(applied).toHaveLength(frames.length);
        const hello = frames[0];
        expect(hello.msg.t).toBe("hello");
        for (const [frame, cycle] of applied.slice(1)) {
            expect(cycle).toBe(frameCycle(frame.recv, hello.recv));
        }
        // A hand-computed spot check: the fixture's first tick arrives 435 ms after its hello.
        expect(frames[1].recv - hello.recv).toBe(435);
        expect(applied[1][1]).toBe(21);
    });
});

describe("snapshot and restore", () => {
    const reference = (() => {
        const { ph } = playhead();
        playToEnd(ph);
        return json(ph.world.snapshot());
    })();

    test("the fixture plays to a populated world", () => {
        const s = JSON.parse(reference);
        expect(s.players.length).toBe(2);
        expect(s.npcs.length).toBeGreaterThan(100);
        expect(s.tick).toBe(ticks[ticks.length - 1]);
    });

    test("snapshot -> JSON -> restore at every tick ends exactly where continuous play does", () => {
        for (const k of ticks) {
            const first = playhead();
            playToTick(first.ph, k);
            const keysBefore = [[...first.ph.world.players.keys()], [...first.ph.world.npcs.keys()]];
            const checkpoint = JSON.parse(json(first.ph.checkpoint())) as Checkpoint;

            const second = playhead();
            second.ph.restore(checkpoint);
            // Map insertion order is simulation state; restore must keep it.
            expect([[...second.ph.world.players.keys()], [...second.ph.world.npcs.keys()]]).toEqual(keysBefore);
            expect(json(second.ph.world.snapshot())).toBe(json(checkpoint.world));

            playToEnd(second.ph);
            expect(json(second.ph.world.snapshot())).toBe(reference);
        }
    });

    test("the snapshot field lists cover every entity field", () => {
        const known = new Set<string>([
            ...ENTITY_NUMBER_FIELDS,
            ...ENTITY_ARRAY_FIELDS,
            ...ENTITY_DERIVED_FIELDS,
            "routeRun",
            "chatMessage",
            "appearance",
        ]);
        for (const e of [new LivePlayer(1), new LiveNpc(1)]) {
            for (const key of Object.keys(e)) expect(known.has(key) ? key : `unlisted field ${key}`).toBe(key);
        }
    });
});

// The fixture as a published clip: 30-tick chunks, each led by its checkpoint.
function fixtureClip(): { manifest: ClipManifest; chunks: ChunkData[] } {
    const { ph } = playhead();
    const chunks = [...cutChunks(ph, 30)].map((c) => JSON.parse(json(c)) as ChunkData);
    let f0 = 0;
    const entries = chunks.map((c, i) => {
        const ks = c.frames.flatMap((f) => (f.msg.t === "tick" ? [f.msg.k] : []));
        const entry = {
            k0: ks[0],
            k1: ks[ks.length - 1],
            recv0: c.frames[0].recv,
            recv1: c.frames[c.frames.length - 1].recv,
            f0,
            frames: c.frames.length,
            cycle0: c.checkpoint.world.loopCycle,
            file: `chunk-${i}.jsonl`,
            bytes: 0,
            sha256: "",
        };
        expect(c.checkpoint.frameIndex).toBe(f0);
        f0 += c.frames.length;
        return entry;
    });
    const manifest: ClipManifest = {
        v: 1,
        clip: "fixture",
        revision: 289,
        cacheId: "stub",
        follow: { name: "Alpha One", slot: 1 },
        anchor: { kOffset: 53 },
        window: { kStart: ticks[0], kEnd: ticks[ticks.length - 1], recvStart: frames[0].recv, recvEnd: frames[frames.length - 1].recv },
        subs: [],
        chunks: entries,
        redaction: { rosterNamesReplaced: 0, appearanceNamesReplaced: 0, playerTextDropped: 0, npcTextDropped: 0, namesScanned: 0, hits: 0 },
    };
    return { manifest, chunks };
}

function driver() {
    const { manifest, chunks } = fixtureClip();
    const { controller } = (() => {
        let made: ReturnType<typeof stubController> | undefined;
        return { controller: undefined as never, made };
    })();
    void controller;
    const d = new ReplayDriver(manifest, (i) => Promise.resolve(JSON.parse(json(chunks[i])) as ChunkData));
    // Build the controller through the driver's own feed factory, as MapViewer.startLive does.
    const { LiveController } = require("../src/live/LiveController") as typeof import("../src/live/LiveController");
    const stubs = require("./stubs") as typeof import("./stubs");
    const c = new LiveController(d.feed, stubs.npcTypeLoader, stubs.seqTypeLoader, stubs.seqFrameLoader, undefined, 289);
    d.bind(c);
    return { d, c, manifest, chunks };
}

describe("ReplayDriver", () => {
    test("the fixture cuts into several chunks on cycle boundaries", () => {
        const { manifest } = fixtureClip();
        expect(manifest.chunks.length).toBeGreaterThanOrEqual(4);
        expect(manifest.chunks.reduce((n, c) => n + c.frames, 0)).toBe(frames.length);
    });

    test("seek lands in the same state as continuous play, backward and forward", async () => {
        const { d } = driver();
        const reference = (k: number) => {
            const { ph } = playhead();
            playToTick(ph, k);
            return json(ph.world.snapshot());
        };
        // Backward from the end, forward within a chunk, forward across chunks, and back to the start.
        for (const k of [ticks[110], ticks[40], ticks[45], ticks[95], ticks[0], ticks[61]]) {
            expect(await d.seek(k)).toBe(true);
            expect(json(d["playhead"]!.world.snapshot())).toBe(reference(k));
            expect(d.getSnapshot().k).toBe(k);
        }
    });

    test("speed runs speed x wall cycles, capped at 50 per frame; pause runs nothing", async () => {
        const { d, c } = driver();
        await d.seek(ticks[0]);
        const at = () => c.world.loopCycle;
        d.step(3);
        expect(at()).toBe(c.world.loopCycle);
        const before = at();
        d.play();
        d.step(3);
        expect(at() - before).toBe(3);
        d.setSpeed(16);
        let mark = at();
        d.step(2);
        expect(at() - mark).toBe(32);
        mark = at();
        d.step(10);
        expect(at() - mark).toBe(MAX_CYCLES_PER_FRAME);
        d.pause();
        mark = at();
        d.step(10);
        expect(at()).toBe(mark);
    });

    test("playing on matches continuous play, and stops at the end of the clip", async () => {
        const { d, c } = driver();
        await d.seek(ticks[0]);
        d.setSpeed(16);
        d.play();
        for (let i = 0; i < 1000 && !d.getSnapshot().ended; i++) {
            d.step(4);
            await Promise.resolve();
        }
        expect(d.getSnapshot().ended).toBe(true);
        const { ph } = playhead();
        playToEnd(ph);
        expect(json(c.world.snapshot())).toBe(json(ph.world.snapshot()));
    });

    test("a seek keeps following the same account by name", async () => {
        const { d, c } = driver();
        await d.seek(ticks[20]);
        const alpha = [...c.world.players.values()].find((p) => p.name === "Alpha One")!;
        c.follow(alpha);
        expect(c.followSlot).toBe(1);
        await d.seek(ticks[5]);
        expect(c.followName).toBe("Alpha One");
        expect(c.followSlot).toBe(-1);
    });
});
