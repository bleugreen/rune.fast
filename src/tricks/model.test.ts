import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TricksPage } from '../pages/TricksPage';
import { projectTricks } from '../../scripts/public-tricks';
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
    expect(headlineFacts(TRICKS)).toEqual({ used: 20, halved: 9 });
  });

  test('the headline is the title and the subtitle, with nothing between them and the first group', () => {
    const html = renderToStaticMarkup(createElement(TricksPage));
    const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/)![1]!;
    const text = (s: string) => s.replace(/<[^>]+>/g, '\n').split('\n').map((x) => x.trim()).filter(Boolean);
    expect(text(header)).toEqual(['Twenty techniques that made the run', 'Nine of them cut a cost in half or more']);
    const between = html.slice(html.indexOf('</header>') + '</header>'.length, html.indexOf('<h2'));
    expect(text(between)).toEqual([]);
  });
});

describe('sources in the build', () => {
  const shipped = projectTricks(TRICKS);
  const byId = new Map(shipped.map((t) => [t.id, t]));

  test('keeps every line, and prints no address or UTC time', () => {
    expect(shipped.map((t) => t.sources.length)).toEqual(TRICKS.map((t) => t.sources.length));
    const lines = shipped.flatMap((t) => t.sources);
    expect(lines.filter((s) => /cairn:|\d{2}:\d{2}Z\b/.test(s))).toEqual([]);
  });

  test('says who, where and when in plain words', () => {
    expect(byId.get('wine-fermentation')!.sources).toContain(
      'rs-sdk fork, docs/speedrun/skills/cooking.md lines 33-49 (45-51 active ticks, three runs; kebabs 131; the 450-wine model)',
    );
    expect(byId.get('wine-fermentation')!.sources).toContain('issue rs/47 (the wine route, merged)');
    expect(byId.get('charge')!.sources).toContain(
      "main's thread, correction, 26 Oct 14:08 PDT (publish the rate, not a per-tick count)",
    );
    expect(byId.get('buyouts')!.sources).toContain('swarm post 369');
  });

  test('UTC moments become Pacific, carrying the date across midnight', () => {
    const lines = shipped.flatMap((t) => t.sources);
    expect(lines).toContain(
      'the run host’s screen recording of attempt 5, 26 Oct 03:28:39-03:28:53 PDT, cropped to the game canvas (the clip)',
    );
    expect(lines).toContain('the attempts timeline, attempt 5, 25 Oct 13:35 PDT');
    expect(lines).toContain('the attempts timeline, attempt 5, 25 Oct 20:25 PDT to 25 Oct 20:40 PDT');
    expect(lines).toContain(
      'the attempts timeline, rehearsal 23 Oct 21:38 PDT and 23 Oct 23:28 PDT; attempt 5, 25 Oct 20:40 PDT',
    );
  });
});
