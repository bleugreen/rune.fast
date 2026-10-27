import { describe, expect, test } from 'bun:test';
import raw from '../../data/attempts-timeline.json';
import type { ArchivalTimeline } from '../data/types';
import { projectTimeline } from '../../scripts/public-timeline';
import { LOGINS, ROWS, buildChartModel, drawnMarks, isScored, recordFacts } from './model';

const archival = raw as unknown as ArchivalTimeline;
const timeline = projectTimeline(archival);
const model = buildChartModel(timeline);

describe('public projection', () => {
  const text = JSON.stringify(timeline);
  test.each([
    ['helper accounts', /cairn_[a-z]+\d/],
    ['lab accounts', /\bdr\d{4}[a-z]\b/],
    ['hostnames', /bgsrv/],
    ['process tokens', /\bmv[a-z0-9]{6}\b/],
    ['message ids', /msg_id/],
    ['archival paths', /\/Users\//],
    ['the swarm’s addresses', /cairn:/],
  ])('drops %s', (_, re) => expect(text).not.toMatch(re));

  test('prints each source as who, where and when, on the Pacific 12-hour clock with no zone', () => {
    const lines = new Set(timeline.attempts.flatMap((a) => [a.start, a.end, ...a.events].flatMap((x) => x.sources)));
    expect(lines).toContain("host's messages, 23 Oct 10:41 AM");
    expect(lines).toContain('issue rs/843, comment 54, 26 Oct 4:16 AM');
    expect(lines).toContain('the rs project (tenet 39), 25 Oct 9:09 PM');
  });

  test('keeps every event', () => {
    expect(timeline.attempts.map((a) => a.events.length)).toEqual(archival.attempts.map((a) => a.events.length));
  });
});

describe('logged-in spans', () => {
  test('every scored attempt has spans, and only those', () => {
    const scoredIds = timeline.attempts.filter(isScored).map((a) => a.id).sort();
    expect(Object.keys(LOGINS).sort()).toEqual(scoredIds);
  });

  test.each(Object.keys(LOGINS))('%s spans are ordered, non-overlapping, inside the attempt', (id) => {
    const am = model.byId.get(id)!;
    let cursor = -Infinity;
    for (const s of am.spans!) {
      expect(s.from).toBeGreaterThanOrEqual(cursor);
      if (s.to !== null) expect(s.to).toBeGreaterThanOrEqual(s.from);
      cursor = s.to ?? s.from;
    }
    expect(am.spans![0]!.from).toBeGreaterThanOrEqual(am.start);
    expect(cursor).toBeLessThanOrEqual(am.end);
  });

  test('the long holds are the ones the timeline describes', () => {
    const minutes = (id: string) => model.byId.get(id)!.holds.map((g) => Math.floor((g.to - g.from) / 60000));
    // offline_note: '~86 min'; '~9h08m'; the S27 hold; '~6h46m'
    expect(minutes('A3')).toEqual([85]);
    expect(minutes('A5')).toEqual([548, 350, 406]);
  });
});

describe('rows and axis', () => {
  test('every attempt is drawn exactly once', () => {
    expect(ROWS.flat().sort()).toEqual(timeline.attempts.map((a) => a.id).sort());
  });
  test('every attempt and event lies on the axis', () => {
    const [lo, hi] = model.domain;
    for (const am of model.byId.values()) {
      for (const m of am.marks) {
        expect(m.t).toBeGreaterThanOrEqual(lo);
        expect(m.t).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe('the marks the chart draws', () => {
  const drawn = drawnMarks(model.last);
  test('the last attempt died once', () => {
    expect(drawn.filter((m) => m.kind === 'death').map((m) => m.event.utc)).toEqual(['2026-10-26T03:40:37Z']);
  });
  test('the last attempt’s nine in-world stops, and no stop made while logged out', () => {
    expect(drawn.filter((m) => m.kind === 'stop').map((m) => m.event.utc)).toEqual([
      '2026-10-25T07:33:09.659Z',
      '2026-10-25T08:12:47.592Z',
      '2026-10-25T09:06:10Z',
      '2026-10-25T09:33:29.668Z',
      '2026-10-25T18:52:06Z',
      '2026-10-25T20:35:45.809Z',
      '2026-10-25T21:34:39.948Z',
      '2026-10-26T03:25:55.176Z',
      '2026-10-26T03:36:26.963Z',
    ]);
  });
  test('only the last attempt reached the finish', () => {
    expect(model.last.attempt.final_ticks.value).toBe(timeline.meta.record.final_ticks);
  });
});

describe('the record', () => {
  const r = recordFacts(timeline);
  test('the margin is the one the record states, never 130', () => {
    expect(timeline.meta.record.exact_margin.startsWith(`${r.margin} ticks / ${(r.margin * r.tickMs) / 1000} s`)).toBe(true);
  });
});


describe('plain-language lines', () => {
  const events = timeline.attempts.flatMap((a) => a.events.map((e) => ({ id: a.id, e })));
  test('every event is keyed uniquely by attempt and time', () => {
    const keys = events.map(({ id, e }) => plainKey(id, e.utc));
    expect(new Set(keys).size).toBe(keys.length);
  });
  test('every event that is not an operator message has one', () => {
    const missing = events.filter(({ id, e }) => e.type !== 'operator' && !plainFor(id, e.utc)).map(({ id, e }) => plainKey(id, e.utc));
    expect(missing).toEqual([]);
  });
  test('no line points at an event the timeline lacks', () => {
    const known = new Set(events.map(({ id, e }) => plainKey(id, e.utc)));
    expect(plainKeys().filter((k) => !known.has(k))).toEqual([]);
  });
});

describe('pulled quotes', () => {
  test.each(PULLED.map((q) => [q.utc, q] as const))('%s is an operator message with a quote', (_, q) => {
    const m = findMark(model, q.attempt, q.utc);
    expect(m.kind).toBe('operator');
    expect(m.event.quote?.length).toBeGreaterThan(0);
    expect(m.t).toBe(parseUtc(q.utc));
  });
});
