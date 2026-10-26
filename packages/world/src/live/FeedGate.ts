import { FeedHello, FeedMessage } from "./protocol";

// rs-dash WorldFeedClient's acceptance rules, as a pure function so a recorded feed is gated
// exactly like the live socket was. Frames must already have passed parseFeedFrame.
export type FeedGateState = {
    hello?: FeedHello;
    lastTick?: number;
    lastRosterTick?: number;
};

export type FeedGateVerdict = "epoch" | "tick" | "roster" | "drop";

export const INITIAL_GATE: FeedGateState = {};

// A hello always starts a new epoch (a recorded reconnect); nothing before the first hello is
// accepted. Ticks: at or after the hello's tick, and either newer than the last accepted tick or
// a reset repeating it (area baselines can repeat the current source tick). Rosters: at or after
// the hello's tick and strictly newer than the last accepted roster.
export function gateFrame(
    state: FeedGateState,
    msg: FeedMessage,
): { state: FeedGateState; verdict: FeedGateVerdict } {
    switch (msg.t) {
        case "hello":
            return { state: { hello: msg }, verdict: "epoch" };
        case "tick": {
            const hello = state.hello;
            if (!hello || msg.k < hello.tick) return { state, verdict: "drop" };
            const last = state.lastTick;
            if (last !== undefined && (msg.k < last || (msg.k === last && !msg.reset))) {
                return { state, verdict: "drop" };
            }
            return { state: { ...state, lastTick: msg.k }, verdict: "tick" };
        }
        case "roster": {
            const hello = state.hello;
            if (!hello || msg.k < hello.tick) return { state, verdict: "drop" };
            if (state.lastRosterTick !== undefined && msg.k <= state.lastRosterTick) {
                return { state, verdict: "drop" };
            }
            return { state: { ...state, lastRosterTick: msg.k }, verdict: "roster" };
        }
    }
}
