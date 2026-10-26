import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SECTION_META } from '../story/sections';
import { TRICKS } from '../tricks/model';
import { CLIPS, tickAt } from './registry';

/** The ceiling on one clip's file, so a page of clips stays light. */
const MAX_BYTES = 3_000_000;
const file = (src: string) => join('public', src);

/** An MP4's first video track: its frame size from tkhd and the movie's length from mvhd. */
function mp4Facts(buf: Buffer): { width: number; height: number; seconds: number } {
  let width = 0;
  let height = 0;
  let seconds = 0;
  const walk = (from: number, to: number) => {
    for (let at = from; at + 8 <= to; ) {
      let size = buf.readUInt32BE(at);
      const type = buf.toString('latin1', at + 4, at + 8);
      let body = at + 8;
      if (size === 1) {
        size = Number(buf.readBigUInt64BE(at + 8));
        body = at + 16;
      } else if (size === 0) size = to - at;
      if (type === 'moov' || type === 'trak') walk(body, at + size);
      if (type === 'mvhd') {
        const v1 = buf[body] === 1;
        const scale = buf.readUInt32BE(body + (v1 ? 20 : 12));
        const length = v1 ? Number(buf.readBigUInt64BE(body + 24)) : buf.readUInt32BE(body + 16);
        seconds = length / scale;
      }
      if (type === 'tkhd' && !width) {
        const end = at + size;
        // Width and height close the box, as 16.16 fixed point; an audio track's are zero.
        width = buf.readUInt32BE(end - 8) / 65536;
        height = buf.readUInt32BE(end - 4) / 65536;
      }
      at += size;
    }
  };
  walk(0, buf.length);
  return { width, height, seconds };
}

/** A baseline or progressive JPEG's frame size, from its start-of-frame marker. */
function jpegSize(buf: Buffer): { width: number; height: number } {
  for (let at = 2; at + 9 < buf.length; ) {
    const marker = buf[at + 1]!;
    const len = buf.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(at + 5), width: buf.readUInt16BE(at + 7) };
    at += 2 + len;
  }
  throw new Error('no start-of-frame marker');
}

describe('the clip registry', () => {
  test('ids are unique', () => {
    expect(new Set(CLIPS.map((c) => c.id)).size).toBe(CLIPS.length);
  });

  describe.each(CLIPS.map((c) => [c.id, c] as const))('%s', (_, c) => {
    test('has its file and poster in public/, the file under 3 MB', () => {
      expect(existsSync(file(c.src))).toBe(true);
      expect(existsSync(file(c.poster))).toBe(true);
      expect(statSync(file(c.src)).size).toBeLessThan(MAX_BYTES);
    });

    test('has a caption, a time, a step and a source in plain words', () => {
      for (const s of [c.caption, c.time, c.step, c.source]) expect(s.trim().length).toBeGreaterThan(0);
      expect(JSON.stringify(c)).not.toMatch(/cairn:\/\/|\/Users\/|\/home\//);
    });

    test('runs 10 to 15 seconds', () => {
      expect(c.seconds).toBeGreaterThanOrEqual(10);
      expect(c.seconds).toBeLessThanOrEqual(15);
    });

    test('the file and the poster are the size and length the registry says', () => {
      const v = mp4Facts(readFileSync(file(c.src)));
      expect([v.width, v.height]).toEqual([c.width, c.height]);
      expect(Math.abs(v.seconds - c.seconds)).toBeLessThan(0.1);
      expect(jpegSize(readFileSync(file(c.poster)))).toEqual({ width: c.width, height: c.height });
    });

    test('a tick map, where there is one, starts at 0, rises, ends inside the clip and names its trace', () => {
      if (!c.ticks) return;
      expect(c.trace).toBeTruthy();
      expect(c.ticks[0]![0]).toBe(0);
      for (let i = 1; i < c.ticks.length; i++) {
        expect(c.ticks[i]![0]).toBeGreaterThan(c.ticks[i - 1]![0]);
        expect(c.ticks[i]![1]).toBeGreaterThan(c.ticks[i - 1]![1]);
      }
      expect(c.ticks.at(-1)![0]).toBeLessThan(c.seconds * 1000);
    });
  });

  test('every registered clip is placed on a page, and every placed clip is registered', () => {
    const placed = [
      ...TRICKS.flatMap((t) => (t.clip ? [t.clip] : [])),
      ...SECTION_META.flatMap((s) => s.figures.flatMap((f) => (f.figure.kind === 'clip' && f.figure.id ? [f.figure.id] : []))),
    ];
    expect(new Set(placed)).toEqual(new Set(CLIPS.map((c) => c.id)));
  });
});

describe('tickAt', () => {
  const ticks = [
    [0, 67],
    [91, 68],
    [490, 69],
  ] as const;

  test('is the last tick begun at or before the moment', () => {
    expect(tickAt(ticks, 0)).toBe(67);
    expect(tickAt(ticks, 90)).toBe(67);
    expect(tickAt(ticks, 91)).toBe(68);
    expect(tickAt(ticks, 489.9)).toBe(68);
    expect(tickAt(ticks, 10_000)).toBe(69);
  });

  test('the level-up lab clip shows the level-up ticks its card cites', () => {
    const lab = CLIPS.find((c) => c.id === 'levelup-firemaking')!;
    // The trace records the Firemaking level-ups at server ticks 72, 84 and 96, at 1.70 s, 6.51 s and 11.31 s into the clip.
    expect([1700, 6511, 11307].map((ms) => tickAt(lab.ticks!, ms))).toEqual([72, 84, 96]);
  });
});
