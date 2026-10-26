import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { StoryPage } from '../pages/StoryPage';
import { SECTION_META, storySections } from './sections';
import { story } from './story';

const draft = readFileSync(new URL('../../data/story.md', import.meta.url), 'utf8');

/**
 * The draft's page copy split the plainest way, independently of the page's parser:
 * every blank-line-separated block between the two rules that is not a heading,
 * with block quotes unwrapped into their paragraphs.
 */
function draftParagraphs(md: string): string[] {
  const lines = md.split('\n');
  const a = lines.indexOf('---');
  const b = lines.indexOf('---', a + 1);
  return lines
    .slice(a + 1, b)
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#'))
    .flatMap((p) => (p.startsWith('>') ? p.replace(/^> ?/gm, '').split(/\n\s*\n/) : [p]));
}

function receiptParagraphs(md: string): string[] {
  const lines = md.split('\n');
  const b = lines.indexOf('---', lines.indexOf('---') + 1);
  return lines
    .slice(b + 1)
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#'));
}

const decode = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/* Layout effects (chart width, router links) do not run in a server render, which is all this test needs. */
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
  consoleError(...args);
};
const html = renderToStaticMarkup(
  <MemoryRouter>
    <StoryPage />
  </MemoryRouter>,
);
console.error = consoleError;
const text = decode(html);
const surface = decode(html.replace(/<details[\s\S]*?<\/details>/g, ''));

describe('the draft, placed verbatim', () => {
  const paragraphs = draftParagraphs(draft);

  test('the plain split and the page’s parser find the same paragraphs', () => {
    const parsed = [
      story.byline,
      ...story.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : b.paragraphs))),
    ];
    expect(parsed).toEqual(paragraphs);
  });

  test.each(paragraphs.map((p) => [p.slice(0, 60), p] as const))('the page carries "%s…" byte for byte', (_, p) => {
    expect(surface.includes(p)).toBe(true);
  });

  test('the title and every section title', () => {
    const headings = draft.split('\n').filter((l) => /^#( |# \d+\. )/.test(l));
    expect(headings.length).toBe(1 + SECTION_META.length);
    for (const h of headings) expect(surface.includes(h.replace(/^#+ (\d+\. )?/, ''))).toBe(true);
  });

  test('the reader line above the first rule is not page copy', () => {
    const readerLine = draft.split('\n').find((l) => l.startsWith('Draft v'))!;
    expect(text.includes(readerLine.slice(0, 40))).toBe(false);
  });
});

describe('sources', () => {
  test('every section closes with one closed Sources disclosure', () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details.length).toBe(SECTION_META.length);
    for (const d of details) expect(d).not.toContain('open');
    expect(html.match(/<summary>Sources<\/summary>/g)?.length).toBe(SECTION_META.length);
  });

  test('every receipt reaches a section, and nothing else does', () => {
    const placed = [...new Set(story.sections.flatMap((s) => s.sources))];
    expect(placed.join(' ')).toBe(receiptParagraphs(draft).join(' '));
  });

  test('nothing from the receipts is on the open surface', () => {
    expect(surface).not.toContain('cairn://');
    expect(surface).not.toContain('http');
    for (const s of story.sections) for (const line of s.sources) expect(surface.includes(line.slice(0, 30))).toBe(false);
  });
});

describe('what the page adds to the draft', () => {
  const sections = storySections(story);

  test('every pulled quote is the operator’s words exactly as the prose quotes them', () => {
    for (const s of sections) {
      for (const q of s.pulled) {
        expect(s.blocks.some((b) => b.kind === 'p' && b.text.includes(`"${q}"`))).toBe(true);
        expect(html).toContain(`<blockquote class="pulled">${q.replace(/'/g, '&#x27;').replace(/"/g, '&quot;')}</blockquote>`);
      }
    }
  });

  test('the one outbound link is the talk the prose names, and it is in the sources', () => {
    const hrefs = [...html.matchAll(/<a href="(http[^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['https://www.youtube.com/watch?v=cNm4zyUtWj0']);
    expect(story.sections[0]!.sources.some((s) => s.includes(hrefs[0]!))).toBe(true);
  });

  test('quoted messages render as quotations', () => {
    const quotes = story.sections.flatMap((s) => s.blocks.filter((b) => b.kind === 'quote'));
    expect(quotes.length).toBe(2);
    expect(html.match(/<blockquote class="quotation">/g)?.length).toBe(2);
  });

  test('one figure per section', () => {
    expect(html.match(/<figure/g)?.length).toBe(SECTION_META.length);
  });
});
