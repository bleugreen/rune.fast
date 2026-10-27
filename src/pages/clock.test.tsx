import { describe, expect, test } from 'bun:test';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import rawTimeline from '../../data/attempts-timeline.json';
import { projectTimeline } from '../../scripts/public-timeline';
import { projectTricks } from '../../scripts/public-tricks';
import type { ArchivalTimeline } from '../data/types';
import { story } from '../story/story';
import { TRICKS } from '../tricks/model';
import { AttemptsPage } from './AttemptsPage';
import { CostPage } from './CostPage';
import { HarnessPage } from './HarnessPage';
import rawHarness from '../../data/harness.json';
import { projectHarness } from '../../scripts/public-harness';
import type { RawHarnessData } from '../harness/types';
import { StoryPage } from './StoryPage';
import { TricksPage } from './TricksPage';

/*
 * Every clock time the site prints is Pacific on the 12-hour clock ('2:37 PM',
 * '4:14:43 AM'), and each page names the zone once, on the first clock time a
 * reader meets. Quoted words are evidence and stay as they were said: blockquotes
 * everywhere, and on the story page the narrator's draft, its quoted spans and its
 * receipts, which are imported verbatim (scripts/import-story.ts).
 */

/** A clock time as the site writes it, or a span sharing one period: '2:37 PM', '4:14:43 AM', '3:27:15–3:27:27 AM'. */
const CLOCK = /\b(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)?(?:–(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)?)? [AP]M\b/g;
/** Whatever else reads as a clock once those are taken out: '15:07', '03:28', '2:37\u202fPM', '06:12Z'. */
const STRAY = /\d{1,2}:\d{2}/g;
/** A zone, named or implied. */
const ZONE = /\b(?:P[DS]T|UTC|GMT|Pacific)\b|\d:\d{2}(?::\d{2})?(?:\.\d+)?Z\b/g;

const clocks = (s: string) => s.match(CLOCK) ?? [];
const strays = (s: string) => s.replace(CLOCK, ' ').match(STRAY) ?? [];
const zones = (s: string) => s.match(ZONE) ?? [];
/** What follows the first clock time. */
const afterFirstClock = (s: string) => {
  const m = new RegExp(CLOCK.source).exec(s);
  return m ? s.slice(m.index + m[0].length, m.index + m[0].length + 6) : null;
};

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&#x27;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>' };

/** The text a reader sees, in document order; the SSR markers between adjacent text runs join their runs. */
const textOf = (html: string) =>
  html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, ' ');

const without = (html: string, ...res: RegExp[]) => res.reduce((h, re) => h.replace(re, ' '), html);
const QUOTED = /<blockquote[\s\S]*?<\/blockquote>/g;
const DISCLOSED = /<details[\s\S]*?<\/details>/g;
/** The story page's copy of the draft: its title, byline, section titles, prose and the margin's pulled quotes. */
const DRAFT = [
  /<h1 class="title">[\s\S]*?<\/h1>/g,
  /<p class="byline">[\s\S]*?<\/p>/g,
  /<h2 class="sectionTitle">[\s\S]*?<\/h2>/g,
  /<p class="prose">[\s\S]*?<\/p>/g,
  /<aside class="margin"[^>]*>[\s\S]*?<\/aside>/g,
];

function render(Page: ComponentType): string {
  // Layout effects (chart widths) do not run in a server render, which is all this needs.
  const error = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    error(...args);
  };
  try {
    return renderToStaticMarkup(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
  } finally {
    console.error = error;
  }
}

/** The pages whose own components print the zone, and the open surface each is checked on. */
const ZONED: ReadonlyArray<readonly [string, ComponentType]> = [
  ['/attempts', AttemptsPage],
  ['/tricks', TricksPage],
  ['/cost', CostPage],
  ['/harness', HarnessPage],
];

describe.each(ZONED)('%s', (_, Page) => {
  const html = render(Page);
  // A closed disclosure is not read until opened; its lines are checked as the build ships them, below.
  const surface = textOf(without(html, QUOTED, DISCLOSED));

  test('prints its clock times on the 12-hour clock, and no other kind', () => {
    expect(clocks(surface).length).toBeGreaterThan(0);
    expect(strays(surface)).toEqual([]);
  });

  test('names the zone once, on the first clock time', () => {
    expect(zones(surface)).toEqual(['PDT']);
    expect(afterFirstClock(surface)).toMatch(/^ PDT\b/);
  });
});

describe('/', () => {
  const html = render(StoryPage);

  test('adds no zone and no 24-hour time of its own: the figures, captions and dates leave the zone to the dateline', () => {
    const own = textOf(without(html, ...DRAFT, QUOTED, DISCLOSED));
    expect(clocks(own).length).toBeGreaterThan(0);
    expect(strays(own)).toEqual([]);
    expect(zones(own)).toEqual([]);
  });

  /** The narrator's words, without what they quote: quoted spans and code are the swarm's own and stay as said. */
  const unquoted = (s: string) =>
    s
      .replace(/`[^`\n]+`/g, ' ')
      .replace(/"[^"]*"/g, ' ')
      .replace(/“[^”]*”/g, ' ');
  const narrator = [
    story.title,
    story.byline,
    ...story.sections.flatMap((s) => [s.title, ...s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : []))]),
  ]
    .map(unquoted)
    .join('\n');

  // Runs once the draft on the 12-hour clock is imported (rune/main converted it; rune/12 imports it).
  // The draft before it is on the 24-hour clock throughout, and its narrator writes no 12-hour time at all.
  test.skipIf(clocks(narrator).length === 0)('the narrator names the zone once, on the dateline, and writes the 12-hour clock', () => {
    expect(zones(narrator)).toEqual(['PDT']);
    expect(afterFirstClock(narrator)).toMatch(/^ \(PDT\)/);
    expect(strays(narrator)).toEqual([]);
  });
});

describe('lines behind the disclosures, as the build ships them', () => {
  const timeline = projectTimeline(rawTimeline as unknown as ArchivalTimeline);
  const lines = [
    ...projectTricks(TRICKS).flatMap((t) => t.sources),
    ...timeline.attempts.flatMap((a) => [a.start, a.end, ...a.events].flatMap((x) => x.sources)),
    ...Object.values(projectHarness(rawHarness as unknown as RawHarnessData).sources).flatMap((rows) => rows.map((r) => r.plain)),
  ];

  test('print the 12-hour clock with no zone: the page has named it', () => {
    expect(lines.flatMap(clocks).length).toBeGreaterThan(0);
    expect(lines.filter((l) => strays(l).length || zones(l).length)).toEqual([]);
  });
});
