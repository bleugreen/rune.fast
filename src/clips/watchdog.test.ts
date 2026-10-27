import { describe, expect, test } from 'bun:test';
import { ProgressWatch, STALL_MS } from './watchdog';

describe('the footage watchdog', () => {
  test('reports a stall after 30 s without progress while asked to play', () => {
    const w = new ProgressWatch();
    w.watch(0);
    expect(w.stalled(STALL_MS - 1)).toBe(false);
    expect(w.stalled(STALL_MS)).toBe(true);
  });

  test('any progress starts the 30 s again', () => {
    const w = new ProgressWatch();
    w.watch(0);
    w.moved(20_000);
    expect(w.stalled(STALL_MS + 1)).toBe(false);
    expect(w.stalled(20_000 + STALL_MS)).toBe(true);
  });

  test('watches nothing at rest or paused, and a new watch starts from its own moment', () => {
    const w = new ProgressWatch();
    expect(w.stalled(10 * STALL_MS)).toBe(false);
    w.moved(5);
    expect(w.stalled(10 * STALL_MS)).toBe(false);
    w.watch(0);
    w.rest();
    expect(w.stalled(10 * STALL_MS)).toBe(false);
    w.watch(100_000);
    expect(w.stalled(100_000 + STALL_MS - 1)).toBe(false);
  });
});
