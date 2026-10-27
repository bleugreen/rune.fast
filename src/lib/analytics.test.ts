import { describe, expect, test } from 'bun:test';
import { BEACON_SRC, startAnalytics } from './analytics';

/** A window that records what is added to its head and runs its load and idle callbacks on demand. */
function fakeWindow(hostname: string, { idle = true, readyState = 'loading' as DocumentReadyState } = {}) {
  const added: { src: string; defer: boolean; dataset: Record<string, string> }[] = [];
  const load: (() => void)[] = [];
  const later: (() => void)[] = [];
  const win = {
    location: { hostname },
    document: {
      readyState,
      createElement: () => ({ src: '', defer: false, dataset: {} as Record<string, string> }),
      head: { append: (s: (typeof added)[number]) => added.push(s) },
    },
    addEventListener: (type: string, f: () => void) => type === 'load' && load.push(f),
    setTimeout: (f: () => void) => later.push(f),
    ...(idle ? { requestIdleCallback: (f: () => void) => later.push(f) } : {}),
  };
  return { win: win as unknown as Parameters<typeof startAnalytics>[0], added, load, later };
}

describe('Web Analytics', () => {
  test.each(['localhost', '127.0.0.1', 'rune-fast.pages.dev', 'abc123.rune-fast.pages.dev'])('sends nothing from %s', (host) => {
    const w = fakeWindow(host);
    startAnalytics(w.win);
    expect(w.load.length + w.later.length + w.added.length).toBe(0);
  });

  test.each(['rune.fast', 'www.rune.fast'])('on %s, adds the beacon only after load, when idle', (host) => {
    const w = fakeWindow(host);
    startAnalytics(w.win);
    expect(w.added).toEqual([]);
    w.load.forEach((f) => f());
    expect(w.added).toEqual([]);
    w.later.forEach((f) => f());
    expect(w.added).toHaveLength(1);
    expect(w.added[0]!.src).toBe(BEACON_SRC);
    expect(w.added[0]!.defer).toBe(true);
    expect(JSON.parse(w.added[0]!.dataset.cfBeacon!)).toEqual({
      token: '361721d1f0454779b39c00a62bf112a9',
      spa: true,
      send: { to: '/cdn-cgi/rum' },
    });
  });

  test('without requestIdleCallback, after load on a timer', () => {
    const w = fakeWindow('rune.fast', { idle: false });
    startAnalytics(w.win);
    w.load.forEach((f) => f());
    expect(w.added).toEqual([]);
    w.later.forEach((f) => f());
    expect(w.added).toHaveLength(1);
  });

  test('started after load, waits only for idle', () => {
    const w = fakeWindow('rune.fast', { readyState: 'complete' });
    startAnalytics(w.win);
    expect(w.load).toEqual([]);
    w.later.forEach((f) => f());
    expect(w.added).toHaveLength(1);
  });
});
