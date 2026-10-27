import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { fmtInt } from '../lib/numbers';
import { Clip } from './Clip';
import { CLIPS, clipTickAt } from './registry';

/** The caption's counter, 'tick <n>', as the frame renders it; undefined where there is none. */
function counter(html: string): string | undefined {
  return html.match(/>tick <span[^>]*>([\d,]+)<\/span>/)?.[1];
}

const replays = CLIPS.filter((c) => c.kind === 'replay');
const labs = CLIPS.filter((c) => c.kind === 'video' && c.ticks);

describe('the frame’s tick counter', () => {
  test('the registry has replays and lab clips with tick maps to check', () => {
    expect(replays.length).toBeGreaterThan(0);
    expect(labs.length).toBeGreaterThan(0);
  });

  // A replay's window is numbered in its recording's ticks, not the run's scored count.
  test.each(replays.map((c) => [c.id, c] as const))('replay %s shows no counter', (_, c) => {
    expect(counter(renderToStaticMarkup(<Clip clip={c} />))).toBeUndefined();
    for (const ms of [0, (c.seconds * 1000) / 2, c.seconds * 1000]) expect(clipTickAt(c, ms)).toBeUndefined();
  });

  test.each(labs.map((c) => [c.id, c] as const))('lab clip %s counts the server tick its trace records', (_, c) => {
    if (c.kind !== 'video' || !c.ticks) throw new Error('a lab clip with a tick map');
    expect(counter(renderToStaticMarkup(<Clip clip={c} />))).toBe(fmtInt(c.ticks[0]![1]));
  });
});
