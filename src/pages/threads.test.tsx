import { describe, expect, test } from 'bun:test';
import type { ComponentType, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import rawHarness from '../../data/harness.json';
import rawTimeline from '../../data/attempts-timeline.json';
import { projectHarness } from '../../scripts/public-harness';
import { projectTimeline } from '../../scripts/public-timeline';
import { projectTricks } from '../../scripts/public-tricks';
import { Threaded } from '../components/Coded';
import type { ArchivalTimeline } from '../data/types';
import type { RawHarnessData } from '../harness/types';
import { THREADS } from '../lib/threads';
import { TRICKS } from '../tricks/model';
import { CostPage } from './CostPage';
import { HarnessPage } from './HarnessPage';
import { StoryPage } from './StoryPage';
import { TricksPage } from './TricksPage';

/*
 * The run's threads are named as code wherever a reader sees a thread's name as a name: in prose,
 * labels, captions and source lines, on every page. Left as they are: quoted words, which are
 * evidence; the story's draft, imported verbatim, whose author already writes them as code; a
 * thread's name inside an address ('rs/main'); and 'host' in its everyday sense, the machine.
 */

/** 'host' meaning the machine the run played from, not the thread. */
const MACHINE = /\brun[- ]host\b|\bon-host\b/i;
const NAME = new RegExp(String.raw`\b(?:${THREADS.join('|')})\b`, 'gi');

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&#x27;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>' };
/** The story page's copy of the draft: its title, byline, section titles, prose and the margin's pulled quotes. */
const DRAFT = [
  /<h1 class="title">[\s\S]*?<\/h1>/g,
  /<p class="byline">[\s\S]*?<\/p>/g,
  /<h2 class="sectionTitle">[\s\S]*?<\/h2>/g,
  /<p class="prose">[\s\S]*?<\/p>/g,
  /<aside class="margin"[^>]*>[\s\S]*?<\/aside>/g,
];
/** Set as code: HTML code, and SVG labels in the mono face. */
const CODED = [/<code[\s\S]*?<\/code>/g, /<(text|tspan)\b[^>]*class="[^"]*\bmono\b[^"]*"[^>]*>[\s\S]*?<\/\1>/g];
const QUOTED = [/<blockquote[\s\S]*?<\/blockquote>/g];

/** The text a reader sees, one line per block, with code and quoted words taken out. */
function readerLines(html: string, ...skip: RegExp[]): string[] {
  const text = [...skip, ...CODED, ...QUOTED]
    .reduce((h, re) => h.replace(re, ' '), html)
    .replace(/<!-- -->/g, '')
    .replace(/<\/(?:p|li|div|dd|dt|h\d|figcaption|summary|text|span|time|button)>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e);
  return text
    .split('\n')
    .map((l) => l.replace(/“[^”]*”|"[^"]*"/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Each thread name a line leaves bare, with the words around it. */
function bareNames(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    for (const m of line.matchAll(NAME)) {
      const at = m.index!;
      const end = at + m[0].length;
      if (line[at - 1] === '/' || line[end] === '/') continue; // inside an address
      const around = line.slice(Math.max(0, at - 12), end + 12);
      if (MACHINE.test(around)) continue;
      out.push(line.slice(Math.max(0, at - 40), end + 40));
    }
  }
  return out;
}

function render(node: ReactNode): string {
  // Layout effects (chart widths) do not run in a server render, which is all this needs.
  const error = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    error(...args);
  };
  try {
    return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
  } finally {
    console.error = error;
  }
}

const ROUTES: ReadonlyArray<readonly [string, ComponentType]> = [
  ['/', StoryPage],
  ['/tricks', TricksPage],
  ['/cost', CostPage],
  ['/harness', HarnessPage],
];

describe('thread names are code wherever they stand as names', () => {
  test.each(ROUTES)('%s', (path, Page) => {
    const html = render(<Page />);
    expect(bareNames(readerLines(html, ...(path === '/' ? DRAFT : [])))).toEqual([]);
  });

  test('source lines, as the build ships them', () => {
    const lines = [
      ...projectTricks(TRICKS).flatMap((t) => t.sources),
      ...projectTimeline(rawTimeline as unknown as ArchivalTimeline).attempts.flatMap((a) => [a.start, a.end, ...a.events].flatMap((x) => x.sources)),
      ...Object.values(projectHarness(rawHarness as unknown as RawHarnessData).sources).flatMap((rows) => rows.map((r) => r.plain)),
    ];
    const html = render(<>{lines.map((l, k) => <p key={k}><Threaded text={l} /></p>)}</>);
    expect(bareNames(readerLines(html))).toEqual([]);
  });

  test('the check itself catches a bare name, and passes the machine, addresses and quotes', () => {
    const html = render(
      <>
        <p>main merged it</p>
        <p>the run host’s screen recording, the run-host agent</p>
        <p>cairn://p/rs/main, and “from main”</p>
        <p><code>main</code> merged it</p>
      </>,
    );
    expect(bareNames(readerLines(html))).toEqual(['main merged it']);
  });
});
