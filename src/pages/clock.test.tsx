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
import { CostPage } from './CostPage';
import { HarnessPage } from './HarnessPage';
import rawHarness from '../../data/harness.json';
import { projectHarness } from '../../scripts/public-harness';
import type { RawHarnessData } from '../harness/types';
import { StoryPage } from './StoryPage';
import { TricksPage } from './TricksPage';
import { RoutePage } from './RoutePage';
import { route } from '../route/data';
import { WORDS } from '../route/prose';
import { SHARE_IMAGE, siteMeta } from '../meta';

/*
 * Every clock time the site prints is Pacific on the 12-hour clock ('2:37 PM',
 * '4:14:43 AM'), and no page names the zone: not PDT, PST or Pacific, and never
 * UTC. Quoted words are evidence and stay as they were said: blockquotes and quoted
 * spans everywhere, and on the story page the operator's draft and its receipts,
 * which are imported verbatim (scripts/import-story.ts).
 *
 * One exemption: the story's Sources disclosures (each section's receipts and dig
 * tables) keep the UTC and 24-hour times rune/main's research notes were written in.
 * They are closed by default and the operator ruled them out of scope, and many of
 * their times carry no date, so converting them to Pacific would mean guessing the day.
 * Every other page's disclosure lines are checked below, as the build ships them.
 */

/** A clock time as the site writes it, or a span sharing one period: '2:37 PM', '4:14:43 AM', '3:27:15–3:27:27 AM'. */
const CLOCK = /\b(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)?(?:–(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)?)? [AP]M\b/g;
/** Whatever else reads as a clock once those are taken out: '15:07', '03:28', '2:37\u202fPM', '06:12Z'. */
const STRAY = /\d{1,2}:\d{2}/g;
/** A zone, named or implied. */
const ZONE = /\b(?:P[DS]T|UTC|GMT|Pacific)\b|\d:\d{2}(?::\d{2})?(?:\.\d+)?Z\b/g;

/** A time on the 24-hour clock: an hour past 12, or one written with a leading zero. */
const TWENTY_FOUR = /\b(?:0\d|1[3-9]|2[0-3]):[0-5]\d\b/g;

const clocks = (s: string) => s.match(CLOCK) ?? [];
const strays = (s: string) => s.replace(CLOCK, ' ').match(STRAY) ?? [];
const zones = (s: string) => s.match(ZONE) ?? [];

/** Words without what they quote: quoted spans and code are someone's own words and stay as said. */
const unquoted = (s: string) =>
  s
    .replace(/`[^`\n]+`/g, ' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/“[^”]*”/g, ' ');

/** The attributes a reader or a screen reader meets: alt text, titles and labels. */
const ATTRIBUTES = /\s(?:alt|title|aria-label)="([^"]*)"/g;
const attributes = (html: string) => [...html.matchAll(ATTRIBUTES)].map((m) => m[1]!).join('\n');

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
/** The story page's copy of the draft: its title, byline (credit and research credit), section titles, prose and the margin's pulled quotes. */
const DRAFT = [
  /<h1 class="title">[\s\S]*?<\/h1>/g,
  /<p class="credit">[\s\S]*?<\/p>/g,
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

const PAGES: ReadonlyArray<readonly [string, ComponentType]> = [
  ['/', StoryPage],
  ['/route', RoutePage],
  ['/tricks', TricksPage],
  ['/cost', CostPage],
  ['/harness', HarnessPage],
];

describe.each(PAGES)('%s', (path, Page) => {
  const html = render(Page);
  // A closed disclosure is not read until opened; its lines are checked as the build ships them, below.
  const open = without(html, QUOTED, DISCLOSED);

  test('names no zone, in its text or in its alt text and labels', () => {
    expect(zones(unquoted(textOf(open)))).toEqual([]);
    expect(zones(attributes(open))).toEqual([]);
  });

  // The story's draft is the operator's prose, checked on its own below.
  test('prints its own clock times on the 12-hour clock, and no other kind', () => {
    const own = textOf(path === '/' ? without(open, ...DRAFT) : open);
    expect(clocks(own).length).toBeGreaterThan(0);
    expect(strays(own)).toEqual([]);
  });
});

describe('the story’s draft', () => {
  const narrator = [
    story.title,
    story.byline,
    ...story.sections.flatMap((s) => [s.title, ...s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : []))]),
  ]
    .map(unquoted)
    .join('\n');

  // The operator writes a time whose period the sentence before has given bare ('At 3:40,'), so the
  // check is that every time reads on the 12-hour clock, not that each carries AM or PM.
  test('names no zone, and writes the 12-hour clock', () => {
    expect(clocks(narrator).length).toBeGreaterThan(0);
    expect(zones(narrator)).toEqual([]);
    expect(narrator.match(TWENTY_FOUR) ?? []).toEqual([]);
  });
});

describe('link previews', () => {
  test('name no zone', () => {
    const words = [...Object.values(siteMeta()).flatMap((m) => [m.title, m.description]), SHARE_IMAGE.alt].join('\n');
    expect(zones(words)).toEqual([]);
  });
});

describe('lines behind the disclosures, as the build ships them', () => {
  const timeline = projectTimeline(rawTimeline as unknown as ArchivalTimeline);
  const lines = [
    ...projectTricks(TRICKS).flatMap((t) => t.sources),
    ...timeline.attempts.flatMap((a) => [a.start, a.end, ...a.events].flatMap((x) => x.sources)),
    ...Object.values(projectHarness(rawHarness as unknown as RawHarnessData).sources).flatMap((rows) => rows.map((r) => r.plain)),
    ...route.steps.flatMap((s) => WORDS[s.spec.id]!.sources(s, route)),
  ];

  test('print the 12-hour clock with no zone', () => {
    expect(lines.flatMap(clocks).length).toBeGreaterThan(0);
    expect(lines.filter((l) => strays(l).length || zones(l).length)).toEqual([]);
  });
});
