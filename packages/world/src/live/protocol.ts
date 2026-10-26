// Wire format of the rs-sdk world feed (engine src/web/worldfeed.ts, protocol v1).

export const WORLD_FEED_VERSION = 1;

export type FeedHello = {
    t: "hello";
    v: number;
    rev: number;
    tick: number;
    tickMs: number;
    players: number;
};

// One entity's changes this tick. Keys are only present when relevant.
export type FeedEntity = {
    // player slot / npc nid
    i: number;
    // 1 = first sight: a full record that replaces whatever was in this slot
    f?: number;
    // npc type (first sight and change_type)
    t?: number;
    x?: number;
    z?: number;
    l?: number;
    // steps this tick: [walkDir] or [walkDir, runDir], 0..7 (NW=0 .. SE=7)
    m?: number[];
    // 1 = moved without stepping (teleport), 2 = jump (never interpolate)
    tp?: number;
    // player appearance block, base64
    ap?: string;
    // [seq, delay]
    an?: [number, number];
    // [spotanim, height, delay]
    sp?: [number, number, number];
    // face entity: npc nid or 32768 + player slot, -1 clears
    fe?: number;
    // face fine coord [x, z] (tile * 2 + size)
    fs?: [number, number];
    // [[damage, type], ...]
    hm?: [number, number][];
    // [current, max]
    hp?: [number, number];
    // forced overhead text
    sy?: string;
    // public chat (players) and its [colour, effect]
    ch?: string;
    cc?: [number, number];
    // [startX, startZ, endX, endZ, startCycle, endCycle, facing]
    em?: [number, number, number, number, number, number, number];
};

export type FeedTick = {
    t: "tick";
    k: number;
    ms: number;
    reset?: number;
    p?: FeedEntity[];
    n?: FeedEntity[];
    rp?: number[];
    rn?: number[];
};

// [slot, name, x, z, level, combatLevel]
export type RosterPlayer = [number, string, number, number, number, number];

export type FeedRoster = {
    t: "roster";
    k: number;
    p: RosterPlayer[];
    npcs: number;
};

export type FeedMessage = FeedHello | FeedTick | FeedRoster;

// Bounds are protocol/client capacity limits, not claims about current population.
export const WORLD_FEED_REVISION = 289;
export const MAX_FEED_FRAME_BYTES = 2 * 1024 * 1024;
const MAX_PLAYERS = 2048;
const MAX_NPCS = 32768;
const MAX_TILE = 16383;

type RecordValue = Record<string, unknown>;
const object = (v: unknown): v is RecordValue =>
    v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const tuple = (v: unknown, bounds: [number, number][]): v is number[] =>
    Array.isArray(v) && v.length === bounds.length && v.every((n, i) => integer(n, ...bounds[i]));
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const tile = (v: unknown) => integer(v, 0, MAX_TILE);
const cadence = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 60_000;
const optional = (v: RecordValue, key: string, check: (value: unknown) => boolean) =>
    !(key in v) || check(v[key]);

// Check the variable-width rev-289 appearance before its unchecked binary reader runs.
function appearance(value: unknown): boolean {
    if (
        !text(value, 76) ||
        value.length === 0 ||
        value.length % 4 !== 0 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
    )
        return false;
    let bytes: string;
    try {
        bytes = atob(value);
    } catch {
        return false;
    }
    if (bytes.length < 36 || bytes.length > 56 || bytes.charCodeAt(0) > 1) return false;
    let pos = 2;
    for (let part = 0; part < 12; part++) {
        if (pos >= bytes.length) return false;
        const hi = bytes.charCodeAt(pos++);
        if (hi === 0) continue;
        if (pos >= bytes.length) return false;
        const lo = bytes.charCodeAt(pos++);
        if (part === 0 && hi === 255 && lo === 255) {
            pos += 2;
            break;
        }
    }
    // Five colours, seven u16 animations, u64 name, combat byte, u16 skill.
    if (pos + 30 !== bytes.length) return false;
    return [12, 16, 16, 6, 8].every((max, i) => bytes.charCodeAt(pos + i) < max);
}

function entity(value: unknown, player: boolean): value is FeedEntity {
    if (!object(value) || !integer(value.i, 0, (player ? MAX_PLAYERS : MAX_NPCS) - 1)) return false;
    const checks: Record<string, (v: unknown) => boolean> = {
        f: (v) => v === 1,
        t: (v) => !player && integer(v, 0, 65534),
        x: tile,
        z: tile,
        l: (v) => integer(v, 0, 3),
        m: (v) =>
            Array.isArray(v) && v.length >= 1 && v.length <= 2 && v.every((d) => integer(d, 0, 7)),
        tp: (v) => integer(v, 1, 2),
        ap: (v) => player && appearance(v),
        an: (v) =>
            tuple(v, [
                [-1, 65535],
                [0, 65535],
            ]),
        sp: (v) =>
            tuple(v, [
                [-1, 65535],
                [0, 65535],
                [0, 65535],
            ]),
        fe: (v) => integer(v, -1, 65535),
        fs: (v) =>
            tuple(v, [
                [0, 32767],
                [0, 32767],
            ]),
        hm: (v) =>
            Array.isArray(v) &&
            v.length <= 4 &&
            v.every((h) =>
                tuple(h, [
                    [0, 65535],
                    [0, 3],
                ]),
            ),
        hp: (v) =>
            tuple(v, [
                [0, 65535],
                [0, 65535],
            ]),
        sy: (v) => text(v, 1024),
        ch: (v) => player && text(v, 1024),
        cc: (v) =>
            tuple(v, [
                [0, 255],
                [0, 255],
            ]),
        em: (v) =>
            tuple(v, [
                [0, MAX_TILE],
                [0, MAX_TILE],
                [0, MAX_TILE],
                [0, MAX_TILE],
                [0, 65535],
                [0, 65535],
                [0, 3],
            ]) && v[5] >= v[4],
    };
    if (
        !Object.keys(value).every(
            (k) => k === "i" || (checks[k] !== undefined && checks[k](value[k])),
        )
    )
        return false;
    if ("x" in value !== "z" in value) return false;
    if (("m" in value || "tp" in value) && !("x" in value)) return false;
    return (
        value.f !== 1 ||
        ("x" in value && "z" in value && "l" in value && (player ? "ap" in value : "t" in value))
    );
}

function records(value: unknown, player: boolean): boolean {
    if (!Array.isArray(value) || value.length > (player ? MAX_PLAYERS : MAX_NPCS)) return false;
    const seen = new Set<number>();
    return value.every((v) => {
        if (!entity(v, player) || seen.has(v.i)) return false;
        seen.add(v.i);
        return true;
    });
}

function ids(value: unknown, max: number): boolean {
    return (
        Array.isArray(value) &&
        value.length <= max &&
        value.every((v) => integer(v, 0, max - 1)) &&
        new Set(value).size === value.length
    );
}

// Throws a payload-free diagnostic: never echo names, chat or raw frames into logs/UI.
export function parseFeedFrame(data: unknown, expectedRevision?: number): FeedMessage {
    if (typeof data !== "string") throw new Error("World feed requires text frames");
    if (
        data.length > MAX_FEED_FRAME_BYTES ||
        new TextEncoder().encode(data).length > MAX_FEED_FRAME_BYTES
    ) {
        throw new Error("World feed frame exceeds size limit");
    }
    let v: unknown;
    try {
        v = JSON.parse(data);
    } catch {
        throw new Error("Malformed world feed JSON");
    }
    if (!object(v)) throw new Error("Invalid world feed frame");
    if (v.t === "hello") {
        if (v.v !== WORLD_FEED_VERSION) throw new Error("Unsupported world feed protocol version");
        if (v.rev !== WORLD_FEED_REVISION) throw new Error("Unsupported world feed revision");
        if (expectedRevision !== undefined && v.rev !== expectedRevision)
            throw new Error("World feed/cache revision mismatch");
        if (integer(v.tick) && cadence(v.tickMs) && integer(v.players, 0, MAX_PLAYERS))
            return v as FeedHello;
    } else if (v.t === "tick") {
        // ms is a measured interval: zero and long gaps are valid, unlike hello cadence.
        if (
            integer(v.k) &&
            integer(v.ms) &&
            optional(v, "reset", (n) => n === 1) &&
            optional(v, "p", (p) => records(p, true)) &&
            optional(v, "n", (n) => records(n, false)) &&
            optional(v, "rp", (p) => ids(p, MAX_PLAYERS)) &&
            optional(v, "rn", (n) => ids(n, MAX_NPCS))
        )
            return v as FeedTick;
    } else if (v.t === "roster") {
        const seen = new Set<number>();
        if (
            integer(v.k) &&
            integer(v.npcs, 0, MAX_NPCS) &&
            Array.isArray(v.p) &&
            v.p.length <= MAX_PLAYERS &&
            v.p.every((p) => {
                if (
                    !Array.isArray(p) ||
                    p.length !== 6 ||
                    !integer(p[0], 0, MAX_PLAYERS - 1) ||
                    seen.has(p[0]) ||
                    !text(p[1], 12) ||
                    !/^[A-Za-z0-9 _]+$/.test(p[1]) ||
                    !tile(p[2]) ||
                    !tile(p[3]) ||
                    !integer(p[4], 0, 3) ||
                    !integer(p[5], 0, 255)
                )
                    return false;
                seen.add(p[0]);
                return true;
            })
        )
            return v as FeedRoster;
    }
    throw new Error("Invalid world feed frame schema");
}
