import { FarPlayersSnapshot } from "./FarPlayers";
import { LiveEntity } from "./LiveEntity";
import { PlayerAppearance } from "./PlayerAppearance";
import { RosterPlayer } from "./protocol";

// The live world's simulation state as JSON-safe data, for replay checkpoints. Taken and restored
// only between frames and cycles. Players and NPCs are arrays in Map insertion order, because
// order is state: cycle() visits entities in that order, and an entity facing another reads the
// target mid-pass. Fields derived from an appearance or an NPC type, and the render-written
// height, are rebuilt or left out.
export type LiveWorldSnapshot = {
    v: 1;
    loopCycle: number;
    tick: number;
    // Smoothed measured interval: not recoverable from the hello.
    tickMs: number;
    ticksReceived: number;
    rosterTick: number;
    rosterNpcCount: number;
    rosterPlayers: RosterPlayer[];
    far: FarPlayersSnapshot;
    players: PlayerSnapshot[];
    npcs: NpcSnapshot[];
};

// Mutable per-entity simulation fields, all numbers.
export const ENTITY_NUMBER_FIELDS = [
    "level",
    "x",
    "z",
    "yaw",
    "dstYaw",
    "routeLength",
    "animDelayMove",
    "preanimRouteLength",
    "primaryAnim",
    "primaryAnimFrame",
    "primaryAnimCycle",
    "primaryAnimDelay",
    "primaryAnimLoop",
    "secondaryAnim",
    "secondaryAnimFrame",
    "secondaryAnimCycle",
    "spotanimId",
    "spotanimFrame",
    "spotanimCycle",
    "spotanimLastCycle",
    "spotanimHeight",
    "exactStartX",
    "exactStartZ",
    "exactEndX",
    "exactEndZ",
    "exactMoveEnd",
    "exactMoveStart",
    "exactMoveFacing",
    "faceEntity",
    "faceSquareX",
    "faceSquareZ",
    "chatTimer",
    "chatColour",
    "chatEffect",
    "combatCycle",
    "health",
    "totalHealth",
] as const;

// Typed-array fields, stored as number[].
export const ENTITY_ARRAY_FIELDS = ["routeX", "routeZ", "damageValues", "damageTypes", "damageCycles"] as const;

// Everything else on an entity, and why a snapshot does not carry it. A test holds the three
// lists against the classes, so a new upstream field cannot be silently left out.
export const ENTITY_DERIVED_FIELDS = [
    // identity, the Map key
    "id",
    // from setType (NPCs) or the defaults (players)
    "size",
    "turnspeed",
    // from setType or setAppearance
    "readyanim",
    "turnanim",
    "walkanim",
    "walkanim_b",
    "walkanim_l",
    "walkanim_r",
    "runanim",
    // written by the renderer, never read by the simulation
    "height",
    // LivePlayer: rebuilt by setAppearance
    "modelKey",
    "lodAppearance",
    "lodModelKey",
    "name",
    "combatLevel",
    // LiveNpc: rebuilt from npcTypeId
    "npcType",
] as const;

type EntityNumbers = { [K in (typeof ENTITY_NUMBER_FIELDS)[number]]: number };
type EntityArrays = { [K in (typeof ENTITY_ARRAY_FIELDS)[number]]: number[] };

export type EntitySnapshot = EntityNumbers &
    EntityArrays & {
        id: number;
        routeRun: boolean[];
        chatMessage: string | null;
    };

export type PlayerSnapshot = EntitySnapshot & { appearance?: PlayerAppearance };
export type NpcSnapshot = EntitySnapshot & { npcTypeId: number };

export function snapshotEntity(e: LiveEntity): EntitySnapshot {
    const s: Record<string, unknown> = { id: e.id };
    for (const f of ENTITY_NUMBER_FIELDS) s[f] = e[f];
    for (const f of ENTITY_ARRAY_FIELDS) s[f] = Array.from(e[f]);
    s.routeRun = [...e.routeRun];
    s.chatMessage = e.chatMessage;
    return s as EntitySnapshot;
}

// Copies a snapshot's mutable fields onto a fresh entity whose type or appearance is already set.
export function restoreEntity(e: LiveEntity, s: EntitySnapshot): void {
    for (const f of ENTITY_NUMBER_FIELDS) e[f] = s[f];
    for (const f of ENTITY_ARRAY_FIELDS) e[f] = Int32Array.from(s[f]);
    e.routeRun = [...s.routeRun];
    e.chatMessage = s.chatMessage;
}

export function copyAppearance(a: PlayerAppearance): PlayerAppearance {
    return { ...a, parts: [...a.parts], colours: [...a.colours] };
}
