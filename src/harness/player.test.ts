import { describe, expect, test } from 'bun:test';
import { advance, markIndex, nextMark, pause, play, REST, seek, shownSteps, step, stepTimeline, type PlayerState, type Timeline } from './player';

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
    expect(step(REST, tl, 1)).toMatchObject({ t: 0.25, started: true });
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

  test('has a mark at the end of each step', () => {
    expect(steps.duration).toBe(8800);
    expect(steps.marks).toHaveLength(n + 1);
  });

  test('shows the first step the moment play begins, and all of them at the end', () => {
    expect(shownSteps(n, 0)).toBe(0);
    expect(shownSteps(n, advance(play(REST), 16, steps).t)).toBe(1);
    expect(shownSteps(n, 1)).toBe(n);
  });

  test('each Step press shows one more', () => {
    let s = REST;
    const seen: number[] = [];
    for (let i = 0; i < n; i++) {
      s = step(s, steps, 1);
      seen.push(shownSteps(n, s.t));
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
