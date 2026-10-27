import { describe, expect, test } from 'bun:test';
import { arrivalDelay, dotDelay, TRAVEL_MS } from './figures/frame';
import {
  advance,
  after,
  launchedStep,
  markIndex,
  nextMark,
  pause,
  play,
  REST,
  seek,
  shownSteps,
  step,
  stepTimeline,
  travelSpan,
  type PlayerState,
  type Timeline,
} from './player';

const tl: Timeline = { duration: 1000, marks: [0, 0.25, 0.5, 0.9, 1] };

/** Plays from rest to the end in frames of `dt` ms. */
function playThrough(dt: number): PlayerState {
  let s = play(REST);
  for (let i = 0; i < 10_000 && s.playing; i++) s = advance(s, dt, tl);
  return s;
}

const end = (s: PlayerState) => ({ t: s.t, playing: s.playing, started: s.started });

describe('the playback clock', () => {
  test('rests fully drawn, at the end, until the reader starts it', () => {
    expect(REST).toMatchObject({ t: 1, playing: false, started: false });
  });

  test('play starts from the beginning, never from rest', () => {
    expect(play(REST)).toMatchObject({ t: 0, playing: true, started: true, via: 'play' });
    expect(play({ ...REST, started: true })).toMatchObject({ t: 0 });
    expect(play({ t: 0.4, playing: false, started: true, via: 'key' })).toMatchObject({ t: 0.4, playing: true });
  });

  test('advances linearly, stops at the end and does not loop', () => {
    const s = advance(play(REST), 50, tl);
    expect(s.t).toBeCloseTo(0.05, 9);
    const done = playThrough(16);
    expect(done).toMatchObject({ t: 1, playing: false });
    expect(advance(done, 16, tl)).toBe(done);
  });

  test('a long frame (a background tab) advances by at most 100 ms', () => {
    expect(advance(play(REST), 5000, tl).t).toBeCloseTo(0.1, 9);
  });

  test('pause holds the position', () => {
    const s = pause(advance(play(REST), 300, tl));
    expect(s).toMatchObject({ playing: false });
    expect(s.t).toBeCloseTo(0.1, 9);
  });

  test('steps go mark to mark, both ways, and pause play', () => {
    expect(nextMark(tl, 0.3, 1)).toBe(0.5);
    expect(nextMark(tl, 0.5, 1)).toBe(0.9);
    expect(nextMark(tl, 0.5, -1)).toBe(0.25);
    expect(nextMark(tl, 0, -1)).toBe(0);
    expect(nextMark(tl, 1, 1)).toBe(1);
    const s = step(advance(play(REST), 300, tl), tl, 1);
    expect(s).toMatchObject({ t: 0.25, playing: false, via: 'step' });
  });

  test('from rest, a step starts at the beginning', () => {
    expect(step(REST, tl, 1)).toMatchObject({ t: 0, started: true });
  });

  test('scrubbing clamps to the timeline', () => {
    expect(seek(REST, 1.4).t).toBe(1);
    expect(seek(REST, -1).t).toBe(0);
  });

  test('marks divide the timeline into stretches', () => {
    expect([0, 0.1, 0.25, 0.6, 0.95, 1].map((t) => markIndex(tl, t))).toEqual([0, 0, 1, 2, 3, 4]);
  });

  test('stepping, scrubbing, keys and reduced-motion stepping reach the same end state as play', () => {
    const played = end(playThrough(16));
    let stepped = REST;
    for (let i = 0; i < tl.marks.length; i++) stepped = step(stepped, tl, 1);
    let keyed = REST;
    for (let i = 0; i < tl.marks.length; i++) keyed = step(keyed, tl, 1, 'key');
    const scrubbed = seek(play(REST), 1);
    for (const s of [stepped, keyed, { ...scrubbed, playing: false }]) expect(end(s)).toEqual(played);
  });
});

describe('a figure of equal steps', () => {
  const n = 8;
  const steps = stepTimeline(n, 1100);

  test('has a mark at the start of each step', () => {
    expect(steps.duration).toBe(8800);
    expect(steps.marks).toHaveLength(n);
  });

  test('shows the first step the moment play begins, and all of them at the end', () => {
    expect(shownSteps(n, -1)).toBe(0);
    expect(shownSteps(n, play(REST).t)).toBe(1);
    expect(shownSteps(n, advance(play(REST), 16, steps).t)).toBe(1);
    expect(shownSteps(n, 1)).toBe(n);
  });

  test('each step begins on a mark, so every change of step is a render', () => {
    for (let t = 0; t <= 1; t += 0.001) {
      const before = shownSteps(n, t - 0.0005);
      if (shownSteps(n, t) !== before && t > 0.0005) expect(markIndex(steps, t)).not.toBe(markIndex(steps, t - 0.0005));
    }
  });

  test('each Step press shows one more, from the first press after load or reset', () => {
    let s = REST;
    const seen: number[] = [];
    for (let i = 0; i < n; i++) {
      s = step(s, steps, 1);
      seen.push(shownSteps(n, s.t));
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('what travels', () => {
  const n = 8;
  const steps = stepTimeline(n, 1100);
  /** The step whose messages leave when the figure renders `next` after `prev`. */
  const launch = (prev: PlayerState, next: PlayerState, reduced = false) => launchedStep(n, after(prev, next), reduced);
  const finished: PlayerState = { t: 1, playing: false, started: true, via: 'play' };

  test('the first Step after load or reset launches step one', () => {
    expect(launch(REST, step(REST, steps, 1))).toBe(1);
  });

  test('play launches its first step at once, and each step it crosses', () => {
    const p = play(REST);
    expect(launch(REST, p)).toBe(1);
    expect(launch(p, { ...p, t: 1 / n + 0.001 })).toBe(2);
  });

  test('Play again on a finished figure launches step one, as from rest', () => {
    const again = play(finished);
    expect(again.t).toBe(0);
    expect(launch(finished, again)).toBe(1);
  });

  test('each Step press launches the next step', () => {
    let s = REST;
    for (let k = 1; k <= n; k++) {
      const next = step(s, steps, 1);
      expect(launch(s, next)).toBe(k);
      s = next;
    }
  });

  test('the keyboard, scrubbing, jumps, reset, going back and reduced motion never travel', () => {
    const at = step(step(REST, steps, 1), steps, 1);
    for (const next of [step(at, steps, 1, 'key'), seek(at, 0.9, 'scrub'), seek(at, 0.9, 'jump'), REST, step(at, steps, -1)]) {
      expect(travelSpan(after(at, next), false)).toBeNull();
      expect(launch(at, next)).toBeNull();
    }
    expect(launch(at, step(at, steps, 1), true)).toBeNull();
    expect(launch(REST, play(REST), true)).toBeNull();
  });

  test('pausing or scrolling away mid-step launches nothing', () => {
    const p = advance(play(REST), 300, steps);
    expect(launch(p, pause(p))).toBeNull();
  });

  test('each arrival ring starts where its own dot visibly stops, after the dot leaves', () => {
    for (let j = 0; j < 8; j++) {
      expect(arrivalDelay(j)).toBeGreaterThan(dotDelay(j));
      expect(arrivalDelay(j)).toBeLessThan(dotDelay(j) + TRAVEL_MS);
      expect(arrivalDelay(j) - dotDelay(j)).toBe(arrivalDelay(0));
    }
  });
});
