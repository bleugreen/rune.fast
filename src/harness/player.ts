import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

/**
 * The one playback clock both of the harness page's animations run on. Position is a fraction of
 * the figure's timeline, 0 to 1; `marks` are the positions the reader can step between.
 *
 * A figure rests fully drawn, as its end state, until the reader plays or steps it: it never
 * autoplays or loops, and it pauses when scrolled away. How the position last changed (`via`)
 * decides whether a figure animates the change: playing and the Step button travel, while the
 * arrow keys and scrubbing snap, because keyboard-driven motion should not animate.
 */

export interface Timeline {
  /** Playback length in ms at full speed. */
  duration: number;
  /** Ascending positions in [0, 1]. */
  marks: readonly number[];
}

export type Via = 'play' | 'step' | 'key' | 'scrub' | 'jump';

export interface PlayerState {
  t: number;
  playing: boolean;
  /** False until the reader first plays or steps: the figure shows its printed, complete state. */
  started: boolean;
  via: Via;
}

export const REST: PlayerState = { t: 1, playing: false, started: false, via: 'jump' };

const EPS = 1e-9;
/** A frame longer than this (a background tab) advances by this much, so the playhead never leaps. */
const MAX_FRAME = 100;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function play(s: PlayerState): PlayerState {
  return { t: !s.started || s.t >= 1 ? 0 : s.t, playing: true, started: true, via: 'play' };
}

export function pause(s: PlayerState): PlayerState {
  return s.playing ? { ...s, playing: false } : s;
}

export function advance(s: PlayerState, dt: number, tl: Timeline): PlayerState {
  if (!s.playing) return s;
  const t = Math.min(1, s.t + Math.min(dt, MAX_FRAME) / tl.duration);
  return { ...s, t, playing: t < 1, via: 'play' };
}

/** The next mark after t (or before it, for dir -1), or the timeline's end. */
export function nextMark(tl: Timeline, t: number, dir: 1 | -1): number {
  if (dir > 0) return tl.marks.find((m) => m > t + EPS) ?? 1;
  return [...tl.marks].reverse().find((m) => m < t - EPS) ?? 0;
}

/** Steps to the next mark; from rest, a step goes to the first mark, the beginning. Stepping pauses play. */
export function step(s: PlayerState, tl: Timeline, dir: 1 | -1, via: Via = 'step'): PlayerState {
  const t = s.started ? nextMark(tl, s.t, dir) : dir > 0 ? (tl.marks[0] ?? 0) : 0;
  return { t, playing: false, started: true, via };
}

/** Where the clock stands before the reader first starts it: before the beginning, so the first step is a change. */
export const BEFORE = -1;

/**
 * The stretch a change of state should animate across, from where the position was to where it
 * is now, or null when the change should snap: under reduced motion, from the keyboard, a scrub, a
 * jump or a reset, and any move backwards. From rest the stretch starts before the beginning.
 */
export function travelSpan(
  prev: Pick<PlayerState, 't' | 'started'>,
  next: PlayerState,
  reduced: boolean,
): readonly [number, number] | null {
  if (reduced || !next.started || (next.via !== 'play' && next.via !== 'step')) return null;
  const from = prev.started ? prev.t : BEFORE;
  return next.t > from ? [from, next.t] : null;
}

export function seek(s: PlayerState, t: number, via: Via = 'scrub'): PlayerState {
  return { ...s, t: clamp01(t), started: true, via };
}

/** Which stretch between marks t is in: the index of the last mark at or before it. */
export function markIndex(tl: Timeline, t: number): number {
  let i = -1;
  for (const m of tl.marks) if (m <= t + EPS) i++;
  return i;
}

/**
 * For a figure of `n` equal steps: how many have happened at t. Step k begins at mark (k-1)/n, so
 * each step's change coincides with a mark (and so with a render), and playing from 0 shows the
 * first at once.
 */
export function shownSteps(n: number, t: number): number {
  if (t < 0) return 0;
  return Math.min(n, Math.floor(t * n + 1e-9) + 1);
}

/** n equal steps as a timeline: a mark at the start of each. */
export function stepTimeline(n: number, slot: number): Timeline {
  return { duration: n * slot, marks: Array.from({ length: n }, (_, k) => k / n) };
}

const REDUCED = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(REDUCED).matches);
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

/**
 * Drives a Timeline. React state changes only when the position crosses a mark or play starts or
 * stops; between marks, `onFrame` receives every position so the figure can move its playhead by
 * transform without re-rendering.
 */
export function usePlayer(tl: Timeline, onFrame?: (t: number) => void) {
  const [state, setState] = useState<PlayerState>(REST);
  const live = useRef<PlayerState>(REST);
  const frame = useRef(onFrame);
  frame.current = onFrame;
  const reduced = useReducedMotion();
  const [el, setEl] = useState<HTMLElement | null>(null);

  const commit = useCallback(
    (next: PlayerState) => {
      const prev = live.current;
      live.current = next;
      frame.current?.(next.t);
      const discrete =
        next.playing !== prev.playing ||
        next.started !== prev.started ||
        next.via !== prev.via ||
        markIndex(tl, next.t) !== markIndex(tl, prev.t);
      if (discrete || !next.playing) setState(next);
    },
    [tl],
  );

  useEffect(() => {
    if (!state.playing) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const next = advance(live.current, now - last, tl);
      last = now;
      commit(next);
      if (next.playing) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [state.playing, tl, commit]);

  // Scrolled out of view, it stops.
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) && live.current.playing) commit(pause(live.current));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [el, commit]);

  const toggle = () => commit(live.current.playing ? pause(live.current) : play(live.current));
  const stepBy = (dir: 1 | -1, via: Via = 'step') => commit(step(live.current, tl, dir, via));
  const seekTo = (t: number, via: Via = 'scrub') => commit(seek(live.current, t, via));
  const reset = () => commit(REST);

  const onKeyDown = (e: KeyboardEvent) => {
    // Space on one of the figure's own buttons is that button's click, not the figure's shortcut.
    if (e.key === ' ' && e.target !== e.currentTarget) return;
    if (e.key === ' ') {
      if (reduced) stepBy(1, 'key');
      else toggle();
    } else if (e.key === 'ArrowRight') stepBy(1, 'key');
    else if (e.key === 'ArrowLeft') stepBy(-1, 'key');
    else if (e.key === 'Home') seekTo(0, 'key');
    else if (e.key === 'End') seekTo(1, 'key');
    else return;
    e.preventDefault();
  };

  return { state, live, reduced, ref: setEl, toggle, step: stepBy, seek: seekTo, reset, onKeyDown };
}

export type Player = ReturnType<typeof usePlayer>;

/** The keyboard, as a played figure's accessible name states it: under reduced motion Space steps. */
export const keysLabel = (reduced: boolean) =>
  reduced ? 'Space and the arrow keys step from event to event.' : 'Space plays and pauses; the arrow keys step from event to event.';
