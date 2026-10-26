import { describe, expect, test } from "bun:test";
import { INITIAL_GATE, gateFrame, type FeedGateState } from "../src/live/FeedGate";
import { LivePlayer } from "../src/live/LiveEntity";
import { LiveWorld } from "../src/live/LiveWorld";
import {
    base37ToName,
    nameToBase37,
    readAppearanceName,
    toDisplayName,
    writeAppearanceName,
} from "../src/live/PlayerAppearance";
import { canonicalAccountName } from "../src/live/accountName";
import { MAX_FEED_FRAME_BYTES, parseFeedFrame, type FeedMessage } from "../src/live/protocol";
import { stubController } from "./stubs";

// Ported from rs-dash's WorldFeedClient.test.ts: the protocol and world cases unchanged, the
// socket's gating rules now on FeedGate. Synthetic fixtures only.
const hello = { t: "hello", v: 1, rev: 289, tick: 10, tickMs: 400, players: 1 } as const;
const roster = { t: "roster", k: 10, p: [[1, "Test Player", 3200, 3201, 0, 3]], npcs: 0 } as const;
const tick = { t: "tick", k: 10, ms: 400, reset: 1, p: [] } as const;
const appearance = btoa(String.fromCharCode(...new Array(44).fill(0)));
const firstPlayer = { i: 1, f: 1, x: 3200, z: 3201, l: 0, ap: appearance };

function world() {
    return new LiveWorld(undefined as never, undefined as never, undefined as never, undefined);
}

describe("feed validation", () => {
    test("accepts supported bounded frames and complete appearances", () => {
        for (const frame of [hello, roster, tick, { ...tick, p: [firstPlayer] }]) {
            expect(parseFeedFrame(JSON.stringify(frame), 289)).toEqual(frame as never);
        }
    });
    test("appearance bounds include full equipment and transmog; arrays are capped", () => {
        const full = [0, 0, ...Array.from({ length: 12 }, () => [1, 0]).flat(), ...new Array(30).fill(0)];
        const transmog = [0, 0, 255, 255, 0, 1, ...new Array(30).fill(0)];
        for (const bytes of [full, transmog]) {
            const ap = btoa(String.fromCharCode(...bytes));
            expect(() => parseFeedFrame(JSON.stringify({ ...tick, p: [{ ...firstPlayer, ap }] }))).not.toThrow();
            for (let length = 0; length < bytes.length; length++) {
                const truncated = btoa(String.fromCharCode(...bytes.slice(0, length)));
                expect(() =>
                    parseFeedFrame(JSON.stringify({ ...tick, p: [{ ...firstPlayer, ap: truncated }] })),
                ).toThrow();
            }
        }
        for (const field of ["p", "rp"]) {
            expect(() => parseFeedFrame(JSON.stringify({ ...tick, [field]: new Array(2049).fill(0) }))).toThrow();
        }
        for (const field of ["n", "rn"]) {
            expect(() => parseFeedFrame(JSON.stringify({ ...tick, [field]: new Array(32769).fill(0) }))).toThrow();
        }
    });
    test("producer intervals and boosted health are valid", () => {
        for (const ms of [0, 400, 120000]) {
            const frame = { t: "tick", k: 10, ms, p: [{ ...firstPlayer, hp: [12, 10] }] };
            expect(parseFeedFrame(JSON.stringify(frame))).toEqual(frame as never);
        }
        expect(() => parseFeedFrame(JSON.stringify({ t: "pong" }))).toThrow();
    });
    test("rejects protocol/revision mismatch and malformed/binary/oversized frames", () => {
        for (const frame of [
            null,
            [],
            {},
            { ...hello, v: 2 },
            { ...hello, rev: 290 },
            { ...hello, tickMs: 0 },
            { ...hello, tickMs: 1e100 },
            { ...tick, k: -1 },
            { ...roster, p: [[1, "Test", 1, 2, 4, 3]] },
            { ...roster, p: [roster.p[0], roster.p[0]] },
        ]) {
            expect(() => parseFeedFrame(JSON.stringify(frame))).toThrow();
        }
        expect(() => parseFeedFrame(JSON.stringify(hello), 288)).toThrow("cache revision mismatch");
        expect(() => parseFeedFrame("{")).toThrow();
        expect(() => parseFeedFrame(new Uint8Array())).toThrow();
        expect(() => parseFeedFrame(" ".repeat(MAX_FEED_FRAME_BYTES + 1))).toThrow("size limit");
    });
    test("rejects malformed entity tuples, bounds, truncation and duplicate slots", () => {
        const invalid = [
            { x: -1, z: 1 },
            { x: 1 },
            { x: 1.5, z: 1 },
            { l: 4 },
            { i: 2048 },
            { m: [8], x: 1, z: 1 },
            { m: [0, 1, 2], x: 1, z: 1 },
            { tp: 3 },
            { an: [1] },
            { sp: [1, 2, 3, 4] },
            { fs: [1, -1] },
            { hm: [[1, 9]] },
            { hp: [-1, 1] },
            { em: [1, 2, 3, 4, 20, 10, 0] },
            { cc: [0] },
            { ap: "!!!!" },
            { ap: btoa("short") },
            { ap: appearance.slice(4) },
            { ap: appearance + "AAAA" },
            { f: 1 },
            { ch: "x".repeat(1025) },
        ];
        for (const update of invalid) {
            expect(() => parseFeedFrame(JSON.stringify({ ...tick, p: [{ i: 1, ...update }] }))).toThrow();
        }
        expect(() => parseFeedFrame(JSON.stringify({ ...tick, p: [firstPlayer, firstPlayer] }))).toThrow();
    });
});

describe("FeedGate", () => {
    const run = (frames: object[]) => {
        let state: FeedGateState = INITIAL_GATE;
        return frames.map((f) => {
            const r = gateFrame(state, f as FeedMessage);
            state = r.state;
            return r.verdict;
        });
    };

    test("nothing before the first hello is accepted", () => {
        expect(run([tick, roster, hello, { ...tick, reset: undefined }])).toEqual(["drop", "drop", "epoch", "tick"]);
    });
    test("ticks and rosters before the hello's tick are dropped", () => {
        expect(run([hello, { ...tick, k: 9 }, { ...roster, k: 9 }, { ...tick, k: 10 }])).toEqual(["epoch", "drop", "drop", "tick"]);
    });
    test("a tick must be newer, or a reset repeating the last tick", () => {
        const plain = { t: "tick", ms: 400 };
        expect(
            run([hello, { ...plain, k: 11 }, { ...plain, k: 11 }, { ...plain, k: 11, reset: 1 }, { ...plain, k: 10 }, { ...plain, k: 12 }]),
        ).toEqual(["epoch", "tick", "drop", "tick", "drop", "tick"]);
    });
    test("rosters must be strictly newer", () => {
        expect(run([hello, roster, roster, { ...roster, k: 11 }, { ...roster, k: 10 }])).toEqual(["epoch", "roster", "drop", "roster", "drop"]);
    });
    test("a repeated hello starts a new epoch and forgets the old one's ticks", () => {
        const plain = { t: "tick", ms: 400 };
        expect(
            run([hello, { ...plain, k: 20 }, { ...roster, k: 20 }, { ...hello, tick: 15 }, { ...plain, k: 16 }, { ...roster, k: 16 }]),
        ).toEqual(["epoch", "tick", "roster", "epoch", "tick", "roster"]);
    });
});

describe("world/controller epochs", () => {
    test("deltas for unknown entities cannot fabricate a baseline", () => {
        const w = world();
        w.applyTick({ t: "tick", k: 1, ms: 400, p: [{ i: 1, x: 3200, z: 3201 }], n: [{ i: 1, t: 1 }] });
        expect(w.players.size).toBe(0);
        expect(w.npcs.size).toBe(0);
    });
    test("area reset preserves independent roster; session reset drops every baseline", () => {
        const w = world();
        w.applyRoster(roster as never);
        w.applyTick({ ...tick, p: [firstPlayer] } as never);
        expect(w.players.size).toBe(1);
        expect(w.far.players.size).toBe(1);
        w.applyTick({ ...tick, k: 11 } as never);
        expect(w.players.size).toBe(0);
        expect(w.rosterPlayers).toHaveLength(1);
        expect(w.far.players.size).toBe(1);
        w.resetSession(1000);
        expect(w.tick).toBe(-1);
        expect(w.rosterTick).toBe(-1);
        expect(w.rosterPlayers).toEqual([]);
        expect(w.far.players.size).toBe(0);
        expect(w.ticksReceived).toBe(0);
        expect(w.tickMs).toBe(1000);
        expect(w.far.getProgress(250)).toBe(0.5);
    });
    test("a new epoch clears the roster and takes the hello's cadence without stale smoothing", () => {
        const { controller: c, handlers } = stubController();
        handlers.onEpoch(hello.tickMs);
        handlers.onHello(hello);
        handlers.onRoster(roster as never);
        handlers.onTick({ ...tick, p: [firstPlayer] } as never);
        expect(c.world.tickMs).toBe(400);
        expect(c.world.tickSpeedMultiplier).toBe(1.05);
        handlers.onEpoch(200);
        expect(c.world.rosterPlayers).toEqual([]);
        expect(c.world.players.size).toBe(0);
        expect(c.world.far.players.size).toBe(0);
        expect(c.world.tickMs).toBe(200);
        expect(c.world.tickSpeedMultiplier).toBe(2.1);
    });
    test("slot reuse cannot return another followed player", () => {
        const { controller: c } = stubController();
        const first = new LivePlayer(1);
        first.name = "First";
        c.world.players.set(1, first);
        c.follow(first);
        expect(c.getFollowed()).toBe(first);
        const replacement = new LivePlayer(1);
        replacement.name = "Second";
        c.world.players.set(1, replacement);
        expect(c.getFollowed()).toBeUndefined();
    });
    test("an epoch unfollows; a rebase that keeps follow drops only the slot", () => {
        const { controller: c, handlers } = stubController();
        const player = new LivePlayer(1);
        player.name = "Helper One";
        c.world.players.set(1, player);
        c.follow(player);
        c.rebase({ keepFollow: true });
        expect(c.followName).toBe("Helper One");
        expect(c.followSlot).toBe(-1);
        handlers.onEpoch(400);
        expect(c.isFollowing()).toBe(false);
    });
    test("a pending follow starts once a roster places the account", () => {
        const { controller: c, handlers } = stubController();
        const camera = { pos: [3242, -26, 3202], yaw: 0, pitch: 0, getPosX: () => 3242, getPosY: () => -26, getPosZ: () => 3202 } as never;
        c.setPendingFollow("helper_one");
        c.update(0, camera, 64, () => undefined);
        expect(c.isFollowing()).toBe(false);
        handlers.onRoster({ t: "roster", k: 10, npcs: 0, p: [[1, "Helper One", 3200, 3201, 0, 3]] });
        c.update(0, camera, 64, () => undefined);
        expect(c.followName).toBe("helper_one");
        expect(c.pendingFollow).toBeUndefined();
    });
    test("all follow entrypoints reject canonical collisions and active follow stops on ambiguity", () => {
        const { controller: c, handlers } = stubController();
        const camera = { pos: [3242, -26, 3202], yaw: 0, pitch: 0, getPosY: () => -26 } as never;
        c.world.applyRoster({ t: "roster", k: 10, npcs: 0, p: [[1, "Helper One", 3200, 3201, 0, 3], [2, "helper_one", 3300, 3301, 0, 3]] });
        c.goToPlayer("helper_one", camera);
        expect(c.isFollowing()).toBe(false);
        c.followAdjacent(1, camera);
        expect(c.isFollowing()).toBe(false);
        const player = new LivePlayer(1);
        player.name = "Helper One";
        c.world.players.set(1, player);
        c.follow(player);
        expect(c.isFollowing()).toBe(false);
        c.world.applyRoster({ t: "roster", k: 11, npcs: 0, p: [[1, "Helper One", 3200, 3201, 0, 3]] });
        c.goToPlayer(" helper_one ", camera);
        expect(c.isFollowing()).toBe(true);
        handlers.onRoster({ t: "roster", k: 12, npcs: 0, p: [[1, "Helper One", 3200, 3201, 0, 3], [2, "helper_one", 3300, 3301, 0, 3]] });
        expect(c.isFollowing()).toBe(false);
        expect(c.getFollowed()).toBeUndefined();
        c.stop();
    });
});

describe("names", () => {
    test("canonical names fold case and separators", () => {
        expect(canonicalAccountName(" HELPER  one ")).toBe("helper_one");
        expect(canonicalAccountName("helper_one")).toBe("helper_one");
    });
    test("base37 encoding round-trips through the client's decoder", () => {
        for (const name of ["Alpha One", "slot_1167", "zz9", "a", "abcdefghijkl"]) {
            const decoded = toDisplayName(base37ToName(nameToBase37(name)));
            expect(canonicalAccountName(decoded)).toBe(canonicalAccountName(name));
        }
    });
    test("the appearance name is rewritten in place without changing the block's length", () => {
        const block = new Uint8Array(44);
        writeAppearanceName(block, nameToBase37("slot_7"));
        expect(block.length).toBe(44);
        expect(base37ToName(readAppearanceName(block))).toBe("slot_7");
        expect(() => parseFeedFrame(JSON.stringify({ ...tick, p: [{ ...firstPlayer, ap: btoa(String.fromCharCode(...block)) }] }))).not.toThrow();
    });
});
