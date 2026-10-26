import { ChunkData, ReplayFrame } from "./clip";
import { Playhead } from "./Playhead";

// Plays the source forward and cuts it into chunks of at least `ticksPerChunk` tick frames, each
// led by the checkpoint it starts from. Every cut falls at a canonical point, so a chunk never
// splits the frames of one cycle. Stops before the first frame received after `endRecv`.
export function* cutChunks(
    playhead: Playhead,
    ticksPerChunk: number,
    endRecv = Number.POSITIVE_INFINITY,
): Generator<ChunkData> {
    let frames: ReplayFrame[] = [];
    let ticks = 0;
    playhead.onFrame = (frame) => {
        frames.push(frame);
        if (frame.msg.t === "tick") ticks++;
    };
    try {
        let checkpoint = playhead.checkpoint();
        for (;;) {
            const next = playhead.source.peek();
            if (next === undefined || next === null || next.recv > endRecv) break;
            playhead.step();
            if (ticks >= ticksPerChunk) {
                yield { checkpoint, frames };
                frames = [];
                ticks = 0;
                checkpoint = playhead.checkpoint();
            }
        }
        if (frames.length > 0) yield { checkpoint, frames };
    } finally {
        playhead.onFrame = undefined;
    }
}
