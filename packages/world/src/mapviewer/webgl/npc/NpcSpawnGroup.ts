import { NpcSpawn } from "./NpcSpawn";
import { AnimationFrames } from "../AnimationFrames";

export type NpcSpawnGroup = {
    idleAnim: AnimationFrames;
    walkAnim: AnimationFrames | undefined;
    spawns: NpcSpawn[];
};
