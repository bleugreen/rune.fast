import { describe, expect, test } from 'bun:test';
import { tickAt, tickIn, yIn, type Points } from './useReadingTick';

/** A step from 100 to 400 with a break at 200: 100 px of prose, a 50 px break, 150 px of prose. */
const points: Points = [
  [0, 100],
  [100, 200],
  [150, 200],
  [300, 400],
];

describe('the reading map', () => {
  test('runs a section’s ticks linearly between its points', () => {
    expect(tickIn(points, 0)).toBe(100);
    expect(tickIn(points, 50)).toBe(150);
    expect(tickIn(points, 225)).toBe(300);
    expect(tickIn(points, 300)).toBe(400);
  });

  test('holds the break’s tick across the break', () => {
    expect(tickIn(points, 100)).toBe(200);
    expect(tickIn(points, 120)).toBe(200);
    expect(tickIn(points, 150)).toBe(200);
  });

  test('puts a tick where the map gives it, a break’s tick at the break’s top', () => {
    expect(yIn(points, 150)).toBe(50);
    expect(yIn(points, 200)).toBe(100);
    expect(yIn(points, 300)).toBe(225);
    for (const t of [120, 180, 260, 390]) expect(tickIn(points, yIn(points, t)!)).toBeCloseTo(t, 9);
  });

  test('before the first section reads its start, between sections the next one’s, after the last the finish', () => {
    const tracks = [
      { top: 1000, height: 300, points },
      { top: 1400, height: 100, points: [[0, 400], [100, 500]] as Points },
    ];
    expect(tickAt(tracks, 0, 999)).toBe(100);
    expect(tickAt(tracks, 1050, 999)).toBe(150);
    expect(tickAt(tracks, 1350, 999)).toBe(400);
    expect(tickAt(tracks, 1450, 999)).toBe(450);
    expect(tickAt(tracks, 2000, 999)).toBe(999);
  });
});
