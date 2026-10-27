import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The routing figure's clock. It plays the figure's steps by itself, one fixed slot each, holds the
 * last step, then starts the lap again. It runs only while the figure is on screen: it starts once
 * most of the figure is in view and pauses when the figure has left, resuming where it stopped. Under
 * reduced motion it never starts, and the figure rests fully drawn.
 */

export interface Loop {
  steps: number;
  /** Each step's share of a lap, in ms. */
  slot: number;
  /** How long the last step stays up before the lap begins again, in ms, on top of its slot. */
  hold: number;
}

export interface AutoState {
  /** ms into the current lap. */
  elapsed: number;
  /** Laps finished, so the first step of a new lap is a change from the last step of the one before. */
  lap: number;
  playing: boolean;
  /** False until the figure first plays: until then it shows its rest state, every step at once. */
  started: boolean;
}

export const IDLE: AutoState = { elapsed: 0, lap: 0, playing: false, started: false };

/** The fraction of the figure that has to be in view before it starts. */
export const START_RATIO = 0.6;
/** A frame longer than this (a background tab) advances by this much, so no step is skipped. */
const MAX_FRAME = 100;

export const lapLength = (l: Loop) => l.steps * l.slot + l.hold;

/** The step showing (1-based) `elapsed` ms into a lap; the last one stays through the hold. */
export function stepAt(l: Loop, elapsed: number): number {
  return Math.min(l.steps, Math.floor(elapsed / l.slot) + 1);
}

/**
 * The clock's answer to how much of the figure is visible: it plays once `START_RATIO` of it is in
 * view, and pauses only when none of it is, so a figure scrolled half away keeps playing.
 */
export function view(s: AutoState, ratio: number, reduced: boolean): AutoState {
  if (reduced) return s.started ? IDLE : s;
  if (!s.playing && ratio >= START_RATIO) return { ...s, playing: true, started: true };
  if (s.playing && ratio <= 0) return { ...s, playing: false };
  return s;
}

export function tick(s: AutoState, dt: number, l: Loop): AutoState {
  if (!s.playing) return s;
  const elapsed = s.elapsed + Math.min(dt, MAX_FRAME);
  const len = lapLength(l);
  return elapsed < len ? { ...s, elapsed } : { ...s, elapsed: elapsed - len, lap: s.lap + 1 };
}

/** The step whose messages set off when the clock moves from `prev` to `next`, or null when none does. */
export function launchedStep(l: Loop, prev: AutoState, next: AutoState): number | null {
  if (!next.playing) return null;
  const k = stepAt(l, next.elapsed);
  if (prev.started && prev.lap === next.lap && stepAt(l, prev.elapsed) === k) return null;
  return k;
}

const REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * Whether the reader asks for reduced motion. False on the first render, as the build's prerender
 * draws it with no reader to ask, and the reader's answer once mounted.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const m = matchMedia(REDUCED);
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

export interface Frame {
  state: AutoState;
  /** The step launched by the change this frame renders. */
  launch: number | null;
}

/**
 * Drives a Loop from the visibility of the element passed to `ref`. React renders only when the
 * step, the lap, or whether it is playing changes; the time inside a step is never drawn.
 */
export function useAutoplay(l: Loop) {
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState<Frame>({ state: IDLE, launch: null });
  const live = useRef<AutoState>(IDLE);
  const [el, setEl] = useState<Element | null>(null);

  const commit = useCallback(
    (next: AutoState) => {
      const prev = live.current;
      live.current = next;
      const changed =
        next.playing !== prev.playing ||
        next.started !== prev.started ||
        next.lap !== prev.lap ||
        stepAt(l, next.elapsed) !== stepAt(l, prev.elapsed);
      if (changed) setFrame({ state: next, launch: launchedStep(l, prev, next) });
    },
    [l],
  );

  useEffect(() => {
    if (!frame.state.playing) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const next = tick(live.current, now - last, l);
      last = now;
      commit(next);
      if (next.playing) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [frame.state.playing, l, commit]);

  // A new observer reports the current visibility at once, so turning reduced motion off while the
  // figure is in view starts it, and turning it on returns the figure to rest.
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries.at(-1)!;
        commit(view(live.current, e.isIntersecting ? e.intersectionRatio : 0, reduced));
      },
      { threshold: [0, START_RATIO] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, reduced, commit]);

  return { frame, reduced, ref: setEl };
}
