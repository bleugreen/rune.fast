import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

  test('every clip and poster is in public/', () => {
    for (const t of TRICKS) {
      if (!t.clip) continue;
      expect(existsSync(join('public', t.clip.src))).toBe(true);
      expect(existsSync(join('public', t.clip.poster))).toBe(true);
    }
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
    expect(headlineFacts(TRICKS)).toEqual({ used: 20, measured: 12, unmeasured: 1, halved: 9 });
  });
});
