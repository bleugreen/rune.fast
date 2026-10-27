import { describe, expect, test } from 'bun:test';
import { markThreads } from './threads';

describe('markThreads', () => {
  test('marks each thread name standing as a name', () => {
    expect(markThreads("main's thread, host to main, 03:38:36Z")).toBe("`main`'s thread, `host` to `main`, 03:38:36Z");
    expect(markThreads('the integration thread merged it; markets, document and autoresearch')).toBe(
      'the `integration` thread merged it; `markets`, `document` and `autoresearch`',
    );
    expect(markThreads('main’s ruling')).toBe('`main`’s ruling');
    expect(markThreads("Main's own ruling")).toBe("`main`'s own ruling");
  });

  test('leaves quoted words as they were said', () => {
    expect(markThreads('main to rs/3: “Two decisions from main.” main has started')).toBe(
      '`main` to rs/3: “Two decisions from main.” `main` has started',
    );
    expect(markThreads('"Main says hold...": host, host\'s thread')).toBe('"Main says hold...": `host`, `host`\'s thread');
  });

  test('leaves addresses, file names, hyphenated words and the run host alone', () => {
    for (const s of ['rs/main assistant', 'main/chat', 'main.ts', 'on-host recording', 'the run-host agent', 'The run host’s screen recording', 'domain', 'hosted']) {
      expect(markThreads(s)).toBe(s);
    }
  });

  test('leaves code already marked', () => {
    expect(markThreads('`main` and main')).toBe('`main` and `main`');
  });
});
