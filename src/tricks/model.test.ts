import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TricksPage } from '../pages/TricksPage';
import { projectTricks } from '../../scripts/public-tricks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jpegSize } from '../../scripts/world/media';
import { clipById } from '../clips/registry';
import { GROUPS, TRICKS, cardText, headlineFacts, hi, inGroup, lo, rejected, savedShare } from './model';

const BASES = ['measured', 'inferred', 'estimated'];
const STEP_CODE = /\b[SHT]\d{2}[a-z]?\b/;
const charted = TRICKS.filter((t) => t.saving);

describe('the data', () => {
  test('ids are unique', () => {
    expect(new Set(TRICKS.map((t) => t.id)).size).toBe(TRICKS.length);
  });

  test.each(charted.map((t) => [t.id, t] as const))('%s: the chart has numeric before and after, and a basis', (_, t) => {
    const s = t.saving!;
    for (const v of [s.before, s.after]) {
      expect(Number.isFinite(lo(v)) && Number.isFinite(hi(v))).toBe(true);
      expect(lo(v)).toBeLessThanOrEqual(hi(v));
      expect(lo(v)).toBeGreaterThanOrEqual(0);
    }
    expect(BASES).toContain(s.basis);
    expect(s.note.length).toBeGreaterThan(0);
    expect(s.before_label.length && s.after_label.length).toBeGreaterThan(0);
  });

  test.each(TRICKS.map((t) => [t.id, t] as const))('%s: no card text carries a bare step code', (_, t) => {
    expect(cardText(t).filter((s) => STEP_CODE.test(s))).toEqual([]);
  });

  test.each(TRICKS.map((t) => [t.id, t] as const))('%s: keeps its sources', (_, t) => {
    expect(t.sources.length).toBeGreaterThan(0);
  });

  test('every technique the run used sits in a group, and only those', () => {
    for (const t of TRICKS) expect(t.group === null).toBe(t.kind === 'rejected');
    const grouped = GROUPS.flatMap((g) => inGroup(TRICKS, g.id));
    expect(grouped.length + rejected(TRICKS).length).toBe(TRICKS.length);
  });

  test('a rejected technique is one line, with no chart or steps', () => {
    for (const t of rejected(TRICKS)) {
      expect(t.saving).toBeNull();
      expect(t.steps_plain).toEqual([]);
      expect(t.what_instead.split(/[.;] /).length).toBeLessThanOrEqual(2);
    }
  });

  test('every card clip is in the clip registry', () => {
    for (const t of TRICKS) if (t.clip) expect(() => clipById(t.clip!)).not.toThrow();
  });

  test('a card has a clip or frames, not both, and its frames are in public/ at the size it says', () => {
    for (const t of TRICKS) {
      if (!t.stills) continue;
      expect(t.clip).toBeNull();
      expect(t.stills.frames.length).toBeGreaterThanOrEqual(3);
      expect(t.stills.frames.length).toBeLessThanOrEqual(4);
      for (const f of t.stills.frames) {
        expect(f.alt.trim().length).toBeGreaterThan(0);
        expect(jpegSize(readFileSync(join('public', f.src)))).toEqual({ width: t.stills.width, height: t.stills.height });
      }
      expect(t.stills.source.label).toBe('lab film');
      expect(t.stills.source.commit).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  test('no clip is on more than one card the page shows', () => {
    const clips = TRICKS.filter((t) => t.kind !== 'rejected' && t.clip).map((t) => t.clip!);
    expect(clips.filter((c, i) => clips.indexOf(c) !== i)).toEqual([]);
  });

  test('the level-up and cannon cards carry their clips', () => {
    const byId = new Map(TRICKS.map((t) => [t.id, t]));
    expect(byId.get('level-up-dismissal')!.clip).toBe('levelup-firemaking');
    expect(byId.get('cannon')!.clip).toBe('finish-cannon');
  });
});

describe('rulings on the figures', () => {
  const byId = new Map(TRICKS.map((t) => [t.id, t]));

  test('the whole-run knife figure is labelled inferred', () => {
    const s = byId.get('knife-on-the-live-server')!.saving!;
    expect(s.basis).toBe('inferred');
    expect(s.note).toMatch(/^Inferred from two rows/);
    expect(Math.round(s.before as number) - Math.round(s.after as number)).toBe(2739);
  });

  test('Charge is stated as its measured rate, never as five casts landing in one tick', () => {
    const text = cardText(byId.get('charge')!).join(' ');
    expect(text).toContain('156 to 163 casts over 32 to 33 ticks');
    expect(text).not.toMatch(/\b(five|5)\b[^.]*\b(one|a|per|each) tick/i);
  });

  test('the wine and reaction figures are measured', () => {
    expect(byId.get('wine-fermentation')!.saving).toMatchObject({ after: [45, 51], basis: 'measured' });
    expect(byId.get('run-host')!.saving).toMatchObject({ before: 123, after: 180, basis: 'measured' });
  });

  test('no card names the run host by its town (the public scan forbids it)', () => {
    expect(JSON.stringify(TRICKS)).not.toMatch(/ashburn/i);
  });
});

describe('order and headline', () => {
  test('within a group, measured charts come first, largest share saved first', () => {
    for (const g of GROUPS) {
      const measured = inGroup(TRICKS, g.id).filter((t) => t.saving?.basis === 'measured');
      const shares = measured.map((t) => savedShare(t.saving!));
      expect(shares).toEqual([...shares].sort((a, b) => b - a));
    }
  });

  test('the page claim', () => {
    expect(headlineFacts(TRICKS)).toEqual({ used: 19, halved: 9 });
  });

  test('the headline is the title and the subtitle, with nothing between them and the first group', () => {
    const html = renderToStaticMarkup(createElement(TricksPage));
    const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/)![1]!;
    const text = (s: string) => s.replace(/<[^>]+>/g, '\n').split('\n').map((x) => x.trim()).filter(Boolean);
    expect(text(header)).toEqual(['Nineteen techniques that made the run', 'Nine of them cut a cost in half or more']);
    const between = html.slice(html.indexOf('</header>') + '</header>'.length, html.indexOf('<h2'));
    expect(text(between)).toEqual([]);
  });
});

describe('sources in the build', () => {
  const shipped = projectTricks(TRICKS);
  const byId = new Map(shipped.map((t) => [t.id, t]));

  test('keeps every line, and prints no address, UTC time or zone', () => {
    expect(shipped.map((t) => t.sources.length)).toEqual(TRICKS.map((t) => t.sources.length));
    const lines = shipped.flatMap((t) => t.sources);
    expect(lines.filter((s) => /cairn:|\d{2}:\d{2}Z\b|\bP[DS]T\b/.test(s))).toEqual([]);
  });

  test('says who, where and when in plain words', () => {
    expect(byId.get('wine-fermentation')!.sources).toContain(
      'rs-sdk fork, docs/speedrun/skills/cooking.md lines 33-49 (45-51 active ticks, three runs; kebabs 131; the 450-wine model)',
    );
    expect(byId.get('wine-fermentation')!.sources).toContain('issue rs/47 (the wine route, merged)');
    expect(byId.get('charge')!.sources).toContain(
      "main's thread, correction, 26 Oct 2:08 PM (publish the rate, not a per-tick count)",
    );
    expect(byId.get('buyouts')!.sources).toContain('swarm post 369');
  });

  test('UTC moments become the Pacific 12-hour clock, carrying the date across midnight', () => {
    const lines = shipped.flatMap((t) => t.sources);
    expect(lines).toContain(
      'the run host’s screen recording of attempt 5, 26 Oct 3:28:39–3:28:53 AM, cropped to the game canvas (the clip)',
    );
    expect(lines).toContain('the attempts timeline, attempt 5, 25 Oct 1:35 PM');
    expect(lines).toContain('the attempts timeline, attempt 5, 25 Oct 8:25 PM to 25 Oct 8:40 PM');
    expect(lines).toContain('the attempts timeline, rehearsal 23 Oct 9:38 PM and 23 Oct 11:28 PM; attempt 5, 25 Oct 8:40 PM');
  });
});
