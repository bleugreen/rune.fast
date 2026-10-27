import { describe, expect, test } from 'bun:test';
import { arrivalDelay, dotDelay, TRAVEL_MS } from './figures/frame';
import { IDLE, lapLength, launchedStep, START_RATIO, stepAt, tick, view, type AutoState, type Loop } from './autoplay';

const loop: Loop = { steps: 8, slot: 1100, hold: 4000 };

/** Advances a playing clock by `ms` in 16 ms frames. */
function run(s: AutoState, ms: number): AutoState {
  for (let t = 0; t < ms; t += 16) s = tick(s, Math.min(16, ms - t), loop);
  return s;
}

const inView = (s: AutoState = IDLE) => view(s, 1, false);

describe('autoplay', () => {
  test('rests, every step shown, until the figure is mostly in view', () => {
    expect(IDLE).toMatchObject({ playing: false, started: false });
    expect(view(IDLE, 0.3, false)).toBe(IDLE);
    expect(view(IDLE, START_RATIO - 0.01, false)).toBe(IDLE);
    expect(view(IDLE, START_RATIO, false)).toMatchObject({ playing: true, started: true, elapsed: 0, lap: 0 });
  });

  test('starts at the first step, and launches it', () => {
    const s = inView();
    expect(stepAt(loop, s.elapsed)).toBe(1);
    expect(launchedStep(loop, IDLE, s)).toBe(1);
  });

  test('keeps playing while partly in view, and pauses only once off screen', () => {
    const s = run(inView(), 2500);
    expect(view(s, 0.2, false)).toBe(s);
    const off = view(s, 0, false);
    expect(off).toMatchObject({ playing: false, elapsed: s.elapsed });
    expect(tick(off, 500, loop)).toBe(off);
  });

  test('back in view, resumes where it paused without launching that step again', () => {
    const off = view(run(inView(), 2500), 0, false);
    const back = view(off, 1, false);
    expect(back).toMatchObject({ playing: true, elapsed: off.elapsed });
    expect(launchedStep(loop, off, back)).toBeNull();
  });

  test('launches each step once, in order', () => {
    let s = inView();
    const seen = [launchedStep(loop, IDLE, s)];
    for (let t = 0; t < loop.steps * loop.slot; t += 16) {
      const next = tick(s, 16, loop);
      const k = launchedStep(loop, s, next);
      if (k !== null) seen.push(k);
      s = next;
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('holds the last step, then loops back to the first and launches it', () => {
    let s = run(inView(), loop.steps * loop.slot + loop.hold - 50);
    expect(stepAt(loop, s.elapsed)).toBe(loop.steps);
    expect(s.lap).toBe(0);
    const next = run(s, 100);
    expect(next).toMatchObject({ lap: 1, playing: true });
    expect(stepAt(loop, next.elapsed)).toBe(1);
    expect(launchedStep(loop, s, next)).toBe(1);
    s = run(next, lapLength(loop));
    expect(s.lap).toBe(2);
  });

  test('the last step is up for its slot and the hold together', () => {
    const last = Array.from({ length: lapLength(loop) }, (_, t) => stepAt(loop, t)).filter((k) => k === loop.steps).length;
    expect(last).toBe(loop.slot + loop.hold);
  });

  test('a long frame (a background tab) advances by at most 100 ms', () => {
    expect(tick(inView(), 5000, loop).elapsed).toBe(100);
  });

  test('never starts under reduced motion, and returns to rest if it was playing', () => {
    for (const ratio of [0, 0.5, START_RATIO, 1]) expect(view(IDLE, ratio, true)).toBe(IDLE);
    expect(view(run(inView(), 3000), 1, true)).toBe(IDLE);
    expect(launchedStep(loop, IDLE, view(IDLE, 1, true))).toBeNull();
  });

  test('each arrival ring starts where its own dot visibly stops, after the dot leaves', () => {
    for (let j = 0; j < 8; j++) {
      expect(arrivalDelay(j)).toBeGreaterThan(dotDelay(j));
      expect(arrivalDelay(j)).toBeLessThan(dotDelay(j) + TRAVEL_MS);
      expect(arrivalDelay(j) - dotDelay(j)).toBe(arrivalDelay(0));
    }
  });
});
