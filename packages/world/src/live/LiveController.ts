import { Camera } from "../mapviewer/Camera";
import { TypeLoader } from "../rs/config/TypeLoader";
import { NpcTypeLoader } from "../rs/config/npctype/NpcTypeLoader";
import { SeqTypeLoader } from "../rs/config/seqtype/SeqTypeLoader";
import { SpotAnimType } from "../rs/config/spotanimtype/SpotAnimType";
import { SeqFrameLoader } from "../rs/model/seq/SeqFrameLoader";
import { IndexedSprite } from "../rs/sprite/IndexedSprite";
import { LiveEntity, LivePlayer } from "./LiveEntity";
import { LiveWorld } from "./LiveWorld";
import { FeedStatus, WorldFeedClient } from "./WorldFeedClient";
import { RosterPlayer } from "./protocol";

// Tiles streamed around the camera; the engine caps a subscription at 384 x 384, which a radius
// of 188 plus the grid padding fills exactly. Past that, players come from the roster instead.
const MIN_AREA_RADIUS = 32;
const MAX_AREA_RADIUS = 188;
// Re-subscribe only when the camera crosses an 8-tile grid line.
const AREA_GRID = 8;

// Follow is an orbit camera around the player's chest: rotating the camera (drag, arrow keys)
// circles the player, the wheel changes the distance, and moving the camera (WASD etc.) stops
// following. "Go to player" starts from the south-west, looking down at 45 degrees.
const FOLLOW_YAW = 182;
const FOLLOW_PITCH = -256;
const FOLLOW_DISTANCE = 12;
const MIN_ORBIT_DISTANCE = 2;
const MAX_ORBIT_DISTANCE = 48;
const MIN_ORBIT_PITCH = -500;
// The top of the view must meet drawn ground: with the 30-degree half field of view, an orbit
// flatter than ~40 degrees shows the black beyond the render distance as sky.
const MAX_ORBIT_PITCH = -228;
// An overview of an area looks down at ~56 degrees from far enough to hold its spread.
const FRAME_PITCH = -320;
const MIN_FRAME_DISTANCE = 22;
const MAX_FRAME_DISTANCE = 72;
// Orbit pivot above the player's feet, in fine units (a tile is 128).
const ORBIT_PIVOT_HEIGHT = 96;
const RS_TO_RADIANS = Math.PI / 1024;

export type LiveOptions = {
    showPlayers: boolean;
    showNpcs: boolean;
    showPlayerNames: boolean;
    showNpcNames: boolean;
    showChat: boolean;
    showCombat: boolean;
};

// Owns the world feed connection and the simulated entities, and drives "follow" camera mode.
// Created by MapViewer for the fixed public feed and the loaded cache revision.
export class LiveController {
    readonly world: LiveWorld;
    readonly feed: WorldFeedClient;

    status: FeedStatus = "closed";
    error?: string;

    options: LiveOptions = {
        showPlayers: true,
        showNpcs: true,
        showPlayerNames: true,
        showNpcNames: false,
        showChat: true,
        showCombat: true,
    };

    // Player being followed: by slot once visible, by name while flying to them.
    followSlot: number = -1;
    followName?: string;
    // From ?follow=<name>: start following once the roster says where they are.
    pendingFollow?: string;
    // Orbit distance in tiles; 0 until the camera has been aimed at the player.
    private orbitDistance: number = 0;
    private lastRosterJumpTick: number = -1;

    // The Live panel's search. It lives here so the next/previous player keys step through the
    // list the panel shows, even with the UI hidden.
    playerFilter: string = "";
    private listed?: { roster: RosterPlayer[]; filter: string; players: RosterPlayer[] };

    private started: boolean = false;
    private disposed: boolean = false;

    // Bumped on any change the UI should re-render for.
    version: number = 0;

    // The client's hitmark sprites (media archive "hitmarks"), indexed by damage type.
    hitmarkSprites: IndexedSprite[] = [];

    constructor(
        readonly url: string,
        npcTypeLoader: NpcTypeLoader,
        seqTypeLoader: SeqTypeLoader,
        seqFrameLoader: SeqFrameLoader,
        spotAnimTypeLoader: TypeLoader<SpotAnimType> | undefined,
        expectedRevision?: number,
    ) {
        this.world = new LiveWorld(
            npcTypeLoader,
            seqTypeLoader,
            seqFrameLoader,
            spotAnimTypeLoader,
        );
        this.feed = new WorldFeedClient(
            url,
            {
                onEpoch: () => {
                    this.world.resetSession();
                    this.unfollow();
                    this.followSlot = -1;
                    this.lastRosterJumpTick = -1;
                    this.listed = undefined;
                    this.version++;
                },
                onHello: (hello) => {
                    this.world.setCadence(hello.tickMs);
                    this.world.far.clear(hello.tickMs);
                    this.version++;
                },
                onTick: (tick) => {
                    this.world.applyTick(tick);
                    this.validateFollow();
                    this.version++;
                },
                onRoster: (roster) => {
                    this.world.applyRoster(roster);
                    this.validateFollow();
                    this.version++;
                },
                onStatus: (status, error) => {
                    this.status = status;
                    this.error = error;
                    this.version++;
                },
            },
            expectedRevision,
        );
        this.feed.setRoster(true);
    }

    stop(): void {
        this.disposed = true;
        this.feed.close();
        this.world.resetSession();
        this.followSlot = -1;
        this.pendingFollow = undefined;
        this.listed = undefined;
        this.version++;
    }

    reconnect(): void {
        if (!this.disposed) this.feed.reconnect();
    }

    // Called once per rendered frame with the 20ms client cycles that elapsed.
    update(
        clientCycles: number,
        camera: Camera,
        renderDistance: number,
        getGroundY: (e: LiveEntity) => number | undefined,
    ): void {
        if (this.disposed) return;
        // Connect on the first rendered frame, so viewers that never render never connect.
        if (!this.started) {
            this.started = true;
            this.feed.connect();
        }

        for (let i = 0; i < clientCycles; i++) {
            this.world.cycle();
        }

        if (this.pendingFollow && this.world.rosterTick !== -1) {
            const name = this.pendingFollow;
            this.pendingFollow = undefined;
            this.goToPlayer(name, camera);
        }

        this.updateFollow(camera, getGroundY);

        // Seeing further than the engine will stream: the half behind the camera is mostly off
        // screen, so slide the area forward, up to half its size (less when looking down).
        const radius = clamp(renderDistance, MIN_AREA_RADIUS, MAX_AREA_RADIUS);
        const ahead =
            clamp(renderDistance - MAX_AREA_RADIUS, 0, MAX_AREA_RADIUS / 2) *
            Math.cos(camera.pitch * RS_TO_RADIANS);
        const yaw = (camera.yaw - 1024) * RS_TO_RADIANS;
        const centerX = camera.getPosX() - Math.sin(yaw) * ahead;
        const centerZ = camera.getPosZ() - Math.cos(yaw) * ahead;
        const x0 = Math.floor((centerX - radius) / AREA_GRID) * AREA_GRID;
        const z0 = Math.floor((centerZ - radius) / AREA_GRID) * AREA_GRID;
        const size = Math.ceil((radius * 2) / AREA_GRID) * AREA_GRID + AREA_GRID;
        this.feed.setArea(x0, z0, size, size);
    }

    isFollowing(): boolean {
        return this.followName !== undefined;
    }

    // Follow a visible player: the camera turns to face them from where it is.
    follow(player: LivePlayer): void {
        const resolved = this.world.resolvePlayer(player.name);
        if (resolved.ambiguous || resolved.player !== player) { this.unfollow(); return; }
        this.followName = player.name;
        this.followSlot = player.id;
        this.orbitDistance = 0;
        this.version++;
    }

    // Fly to a player (they may be outside the streamed area, then the roster has them) and
    // keep following them.
    goToPlayer(name: string, camera: Camera): void {
        const resolved = this.world.resolvePlayer(name);
        if (resolved.ambiguous) { this.unfollow(); return; }
        const visible = resolved.player;
        const entry = resolved.entry;
        if (visible) {
            this.flyTo(camera, visible.x / 128, visible.z / 128);
        } else if (entry) {
            this.flyTo(camera, entry[2] + 0.5, entry[3] + 0.5);
        } else {
            return;
        }
        this.followName = name;
        this.followSlot = -1;
        this.lastRosterJumpTick = this.world.rosterTick;
        this.version++;
    }

    // Look down on an area (tile centre and radius in tiles) without following anyone. `groundY` is
    // the ground height there in fine units, when its map square is loaded.
    frameArea(camera: Camera, tileX: number, tileZ: number, radius: number, groundY = 0): void {
        this.unfollow();
        camera.pitch = FRAME_PITCH;
        const distance = clamp(radius * 1.8 + 16, MIN_FRAME_DISTANCE, MAX_FRAME_DISTANCE);
        placeOrbitCamera(camera, tileX, groundY / 128, tileZ, distance);
    }

    // Online players matching the panel's search, by name.
    listPlayers(): RosterPlayer[] {
        const roster = this.world.rosterPlayers;
        const filter = this.playerFilter.trim().toLowerCase();
        if (this.listed?.roster !== roster || this.listed.filter !== filter) {
            const players = roster
                .filter((p) => !filter || p[1].toLowerCase().includes(filter))
                .sort((a, b) => a[1].localeCompare(b[1]));
            this.listed = { roster, filter, players };
        }
        return this.listed.players;
    }

    // Go to the listed player after (step 1) or before (step -1) the followed one, wrapping
    // around. Without one, start at that end of the list.
    followAdjacent(step: 1 | -1, camera: Camera): void {
        const players = this.listPlayers();
        if (players.length === 0) {
            return;
        }
        let index = step > 0 ? -1 : players.length;
        const followed = this.followName;
        if (followed) {
            const name = followed.toLowerCase();
            index = players.findIndex((p) => p[1].toLowerCase() === name);
            if (index === -1) {
                // Not listed (logged out, or filtered away): step from where they'd sort.
                const after = players.findIndex((p) => p[1].localeCompare(followed) > 0);
                const insertAt = after === -1 ? players.length : after;
                index = step > 0 ? insertAt - 1 : insertAt;
            }
        }
        const next = players[(index + step + players.length) % players.length];
        this.goToPlayer(next[1], camera);
    }

    unfollow(): void {
        if (this.followName === undefined) {
            return;
        }
        this.followSlot = -1;
        this.followName = undefined;
        this.version++;
    }

    // Mouse wheel while following: zoom the orbit in or out.
    zoom(wheelDelta: number): void {
        if (wheelDelta === 0 || this.orbitDistance === 0) {
            return;
        }
        this.orbitDistance = clamp(
            this.orbitDistance * Math.exp(wheelDelta * 0.0015),
            MIN_ORBIT_DISTANCE,
            MAX_ORBIT_DISTANCE,
        );
    }

    private validateFollow(): void {
        if (this.followName && this.world.resolvePlayer(this.followName).ambiguous) this.unfollow();
    }

    getFollowed(): LivePlayer | undefined {
        if (!this.followName) return undefined;
        const player = this.world.resolvePlayer(this.followName).player;
        return player?.id === this.followSlot ? player : undefined;
    }

    // Puts the orbit's default view on a tile, so the area streams in before the player is found.
    private flyTo(camera: Camera, tileX: number, tileZ: number): void {
        camera.yaw = FOLLOW_YAW;
        camera.pitch = FOLLOW_PITCH;
        this.orbitDistance = FOLLOW_DISTANCE;
        placeOrbitCamera(camera, tileX, camera.getPosY(), tileZ, FOLLOW_DISTANCE);
        camera.pos[1] = -FOLLOW_DISTANCE * Math.sin(-FOLLOW_PITCH * RS_TO_RADIANS);
    }

    private updateFollow(camera: Camera, getGroundY: (e: LiveEntity) => number | undefined): void {
        if (!this.followName) {
            return;
        }

        const resolved = this.world.resolvePlayer(this.followName);
        if (resolved.ambiguous) { this.unfollow(); return; }
        const player = resolved.player;
        if (this.followSlot !== (player?.id ?? -1)) {
            this.followSlot = player?.id ?? -1;
            this.version++;
        }
        if (!player) {
            // Not streamed here (teleported, or we haven't arrived): jump to where the roster has
            // them, at most once per roster update.
            if (this.world.rosterTick !== this.lastRosterJumpTick) {
                this.lastRosterJumpTick = this.world.rosterTick;
                const entry = resolved.entry;
                if (
                    entry &&
                    (Math.abs(entry[2] + 0.5 - camera.getPosX()) > 32 ||
                        Math.abs(entry[3] + 0.5 - camera.getPosZ()) > 32)
                ) {
                    this.flyTo(camera, entry[2] + 0.5, entry[3] + 0.5);
                }
            }
            return;
        }

        const groundY = getGroundY(player);
        if (groundY === undefined) {
            // Terrain under them hasn't loaded yet; hold the camera.
            return;
        }
        const targetX = player.x / 128;
        const targetY = (groundY - ORBIT_PIVOT_HEIGHT) / 128;
        const targetZ = player.z / 128;

        if (this.orbitDistance === 0) {
            // Just started following: face the player from where the camera is.
            const dx = targetX - camera.getPosX();
            const dy = targetY - camera.getPosY();
            const dz = targetZ - camera.getPosZ();
            const distance = Math.hypot(dx, dy, dz);
            this.orbitDistance = clamp(distance, MIN_ORBIT_DISTANCE, MAX_ORBIT_DISTANCE);
            camera.yaw = Math.round((Math.atan2(dx, dz) * 1024) / Math.PI) & 2047;
            camera.pitch = Math.round(
                Math.asin(clamp(-dy / Math.max(distance, 0.001), -1, 1)) / RS_TO_RADIANS,
            );
        }

        camera.pitch = clamp(camera.pitch, MIN_ORBIT_PITCH, MAX_ORBIT_PITCH);
        placeOrbitCamera(camera, targetX, targetY, targetZ, this.orbitDistance);
    }
}

// Camera.update: yaw 0 faces north (+z), negative pitch looks down, and the view direction is
// (-cos(p) sin(t), -sin(p), -cos(p) cos(t)) with t = (yaw - 1024) and p = pitch in RS angle units.
function placeOrbitCamera(camera: Camera, x: number, y: number, z: number, distance: number): void {
    const yaw = (camera.yaw - 1024) * RS_TO_RADIANS;
    const pitch = camera.pitch * RS_TO_RADIANS;
    camera.pos[0] = x + Math.cos(pitch) * Math.sin(yaw) * distance;
    camera.pos[1] = y + Math.sin(pitch) * distance;
    camera.pos[2] = z + Math.cos(pitch) * Math.cos(yaw) * distance;
    camera.updated = true;
    camera.updatedPosition = true;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function getDefaultFeedUrl(): string {
    return "wss://rs-sdk-demo.fly.dev/worldfeed";
}
