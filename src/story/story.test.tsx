import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { clipById, clipSource, clipSrc, clipWhen } from '../clips/registry';
import { StoryPage } from '../pages/StoryPage';
import { sourceTable } from './draft';
import { SECTION_META, quotes, storySections } from './sections';
import { plainReceiptLines, plainSourceLines } from './sources';
import { story } from './story';

const data = new URL('../../data/', import.meta.url);
const draft = readFileSync(new URL('story.md', data), 'utf8');
const lines = draft.split('\n');
const rule = lines.indexOf('---');
const receiptsAt = lines.findIndex((l) => l.startsWith('## Receipts'));

const blocksOf = (ls: string[]) =>
  ls
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && p !== '---' && !p.startsWith('#'));

/**
 * The draft's page copy split the plainest way, independently of the page's parser:
 * every blank-line-separated block between the rule and the Receipts that is not a
 * heading, with block quotes unwrapped into their paragraphs.
 */
const paragraphs = blocksOf(lines.slice(rule + 1, receiptsAt)).flatMap((p) =>
  p.startsWith('>') ? p.replace(/^> ?/gm, '').split(/\n\s*\n/) : [p],
);

/** What a reader sees of a paragraph: its characters, less the `code` and *emphasis* delimiters. */
const readerText = (p: string) => p.replace(/`([^`\n]+)`/g, '$1').replace(/\*([^*\s](?:[^*\n]*[^*\s])?)\*/g, '$1');

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
  test('the plain split and the page’s parser find the same paragraphs', () => {
    const parsed = [
      story.byline,
      ...story.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : b.paragraphs))),
    ];
    expect(parsed).toEqual(paragraphs);
  });

  test.each(paragraphs.map((p) => [p.slice(0, 60), p] as const))('the page carries "%s…" byte for byte', (_, p) => {
    expect(surface.includes(readerText(p))).toBe(true);
  });

  test('code spans and emphasis are set, not shown as backticks and asterisks', () => {
    for (const [, code] of draft.slice(0, draft.indexOf('## Receipts')).matchAll(/`([^`\n]+)`/g)) {
      expect(html).toContain(`<code>${code!.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}</code>`);
    }
    expect(html).toContain('<em>more</em>');
    expect(surface).not.toContain('`');
  });

  test('the title and every section title', () => {
    const headings = lines.slice(0, receiptsAt).filter((l) => /^#( |# \d+\. )/.test(l));
    expect(headings.length).toBe(1 + SECTION_META.length);
    for (const h of headings) expect(surface.includes(h.replace(/^#+ (\d+\. )?/, ''))).toBe(true);
  });

  test('the reader line above the rule is not page copy', () => {
    const readerLine = lines.slice(0, rule).find((l) => l.startsWith('Draft v'))!;
    expect(text.includes(readerLine.slice(0, 40))).toBe(false);
  });
});

describe('sources', () => {
  const receipts = blocksOf(lines.slice(receiptsAt + 1));

  test('every section closes with one closed Sources disclosure', () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details.length).toBe(SECTION_META.length);
    for (const d of details) expect(d).not.toContain('open');
    expect(html.match(/<summary>Sources<\/summary>/g)?.length).toBe(SECTION_META.length);
  });

  test('each section’s key anchors open its disclosure, and the introduction to the receipts is left out', () => {
    const intro = receipts[0]!.slice(0, receipts[0]!.search(/(?:^| )S1[: ]/)).trim();
    expect(intro.length).toBeGreaterThan(0);
    expect(text).not.toContain(intro.slice(0, 40));
    story.sections.forEach((s, i) => expect(s.sources[0]).toMatch(new RegExp(`^S${i + 1}[: ]`)));
    for (const later of receipts.slice(1)) {
      for (const line of plainReceiptLines(later)) expect(story.sections.at(-1)!.sources).toContain(line);
    }
  });

  test('each section’s dig table, where it has one, closes its disclosure', () => {
    story.sections.forEach((s) => {
      const file = new URL(`receipts/section-${s.number}.md`, data);
      const table = existsSync(file) ? sourceTable(readFileSync(file, 'utf8')) : null;
      if (!table) return;
      const lines = plainSourceLines(table);
      expect(lines.length).toBeGreaterThan(0);
      expect(s.sources.slice(-lines.length)).toEqual(lines);
    });
  });

  test('sources print no cairn addresses, raw store numbers or transcript turns', () => {
    const all = JSON.stringify(story);
    expect(all).not.toContain('cairn://');
    for (const line of story.sections.flatMap((s) => s.sources)) {
      expect(line).not.toMatch(/\b\d{10,}\b/);
      expect(line).not.toMatch(/\b(?:createdAt|epoch|raw seq)/i);
      expect(line).not.toMatch(/\b[Tt]urns? \d/);
    }
  });

  test('nothing from the receipts is on the open surface', () => {
    expect(surface).not.toContain('http');
    // Source lines often open with the quote the prose prints; what must stay closed is where and when it was said.
    for (const s of story.sections) {
      expect(surface.includes(s.sources[0]!)).toBe(false);
      for (const line of s.sources) {
        const where = line.slice(line.indexOf('": ') + 3);
        if (line.includes('": ') && where.length > 20) expect(surface.includes(where)).toBe(false);
      }
    }
    expect(surface).not.toContain('issue rs/');
  });
});

describe('what the page adds to the draft', () => {
  const sections = storySections(story);

  test('every pulled quote is the operator’s words exactly as the prose quotes them', () => {
    for (const s of sections) {
      for (const q of s.pulled) {
        expect(s.blocks.some((b) => quotes(b, q))).toBe(true);
        expect(html).toContain(`<blockquote class="pulled">${q.replace(/'/g, '&#x27;').replace(/"/g, '&quot;')}</blockquote>`);
      }
    }
  });

  test('the one outbound link is the talk the prose names, and it is in the sources', () => {
    const hrefs = [...html.matchAll(/<a href="(http[^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['https://www.youtube.com/watch?v=cNm4zyUtWj0']);
    expect(story.sections[0]!.sources.some((s) => s.includes(hrefs[0]!))).toBe(true);
  });

  test('quoted messages render as quotations, never as margin quotes', () => {
    const quotes = story.sections.flatMap((s) => s.blocks.filter((b) => b.kind === 'quote'));
    expect(html.match(/<blockquote class="quotation">/g)?.length).toBe(quotes.length);
  });

  test('every figure the page places, and no other', () => {
    const placed = SECTION_META.reduce((n, s) => n + s.figures.length, 0);
    expect(html.match(/<figure/g)?.length).toBe(placed);
  });

  test('the death section sets the body among the spiders after the roster beat, its timeline after the death beat, the re-kit clip after the overnight paragraph, then the Agility clip and the hiscore board', () => {
    const s = sections.find((x) => x.id === 'the-death')!;
    const placed = [...s.figuresAt].sort(([a], [b]) => a - b).flatMap(([at, fs]) => fs.map((f) => ({ at, f })));
    expect(placed.map(({ f }) => (f.kind === 'clip' ? f.id : f.kind))).toEqual(['spider-death', 'timeline', 'finish-rekit', 'finish-agility99', 'image']);
    const [spiders, death, rekit] = placed;
    // The quotation under the paragraph that narrates the roster's last sightings of the body.
    expect(quotes(s.blocks[spiders!.at]!, 'Welp there goes the run')).toBe(true);
    const narrated = s.blocks[spiders!.at - 1]!;
    expect(narrated.kind === 'p' && narrated.text.includes('at the Lumbridge respawn at 8:40:37 PM')).toBe(true);
    expect(quotes(s.blocks[death!.at]!, 'I WANT A #1')).toBe(true);
    expect(death!.f).toEqual({ kind: 'timeline', crop: ['2026-10-26T03:00Z', '2026-10-26T11:30Z'] });
    const rekitBlock = s.blocks[rekit!.at]!;
    expect(rekitBlock.kind === 'p' && rekitBlock.text.startsWith('Overnight the helpers rebuilt the lost kit')).toBe(true);
  });

  test('the attempts section sets attempt 4’s death after the quotation its paragraph introduces', () => {
    const s = sections.find((x) => x.id === 'four-attempts')!;
    const placed = [...s.figuresAt].flatMap(([at, fs]) => fs.map((f) => ({ at, f })));
    const clip = placed.find(({ f }) => f.kind === 'clip' && f.id === 'attempt-4-death')!;
    expect(quotes(s.blocks[clip.at]!, 'ok fine one more attempt')).toBe(true);
    const narrated = s.blocks[clip.at - 1]!;
    expect(narrated.kind === 'p' && narrated.text.includes('the poison finished the account at the tree door')).toBe(true);
  });

  test('the hiscore board follows the quotation the #1 paragraph introduces, its files match it, and its caption reads in Pacific with no zone', () => {
    const s = sections.find((x) => x.id === 'the-death')!;
    const [at, fs] = [...s.figuresAt].find(([, f]) => f.some((x) => x.kind === 'image'))!;
    const image = fs.find((x) => x.kind === 'image')!;
    if (image.kind !== 'image') throw new Error('unreachable');
    const intro = s.blocks[at - 1]!;
    expect(intro.kind === 'p' && intro.text.includes('OFFICIAL #1 VERIFIED') && intro.text.includes('35,787 ticks')).toBe(true);
    expect(s.blocks[at]!.kind).toBe('quote');

    const pub = new URL('../../public', import.meta.url).pathname;
    const png = readFileSync(`${pub}${image.src}.png`);
    // The PNG's IHDR: width and height, big-endian, at bytes 16 and 20.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([image.width, image.height]);
    expect(existsSync(`${pub}${image.src}.webp`)).toBe(true);

    expect(html).toContain(`<source type="image/webp" srcSet="${image.src}.webp"/>`);
    expect(html).toContain(`src="${image.src}.png" width="${image.width}" height="${image.height}"`);
    expect(surface).toContain('The overall hiscores after the run.');
    expect(surface).toContain('The operator’s screenshot, 26 Oct 2026, before 4:30 AM');
  });

  test('each clip in the story renders with its caption, time, step and source', () => {
    const ids = SECTION_META.flatMap((s) => s.figures.flatMap((f) => (f.figure.kind === 'clip' && f.figure.id ? [f.figure.id] : [])));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const c = clipById(id);
      if (c.kind === 'video') expect(html).toContain(`src="${clipSrc(c)}"`);
      for (const s of [c.caption, clipWhen(c), c.step, clipSource(c)]) expect(surface).toContain(s);
    }
  });
});
