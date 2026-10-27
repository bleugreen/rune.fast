import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { clipById, clipSource, clipSrc, clipWhen } from '../clips/registry';
import { AUTHOR } from '../lib/site';
import { StoryPage } from '../pages/StoryPage';
import { inlineTokens, sourceTable } from './draft';
import { CREDIT, SECTION_META, quotes, storyByline, storySections } from './sections';
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
/** The hero tree, ahead of the title in the page's order (src/tree), and the draft's sections after it. */
const HERO = /<figure class="hero[^"]*">[\s\S]*?<\/figure>/;
const hero = html.match(HERO)?.[0] ?? '';
const sectionsHtml = html.replace(HERO, '');

describe('the draft, placed verbatim', () => {
  test('the plain split and the page’s parser find the same paragraphs', () => {
    const parsed = [
      story.byline,
      ...story.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : b.paragraphs))),
    ];
    expect(parsed).toEqual(paragraphs);
  });

  // The byline is set on two lines, checked on its own below.
  test.each(paragraphs.filter((p) => p !== story.byline).map((p) => [p.slice(0, 60), p] as const))('the page carries "%s…" byte for byte', (_, p) => {
    expect(surface.includes(readerText(p))).toBe(true);
  });

  test('the byline is a credit line in ink, the name linked to the author’s site, over the research credit in the draft’s words', () => {
    expect(CREDIT.sentence).toBe('By bleugreen.');
    const { credit, research } = storyByline(story.byline);
    expect(credit).toBe('By bleugreen');
    expect(`${credit}. ${research}`).toBe(story.byline);
    expect(html).toContain(`<p class="credit">By <a href="${AUTHOR.url}" target="_blank" rel="noreferrer">${AUTHOR.name}</a></p><p class="byline">`);
    expect(decode(html.match(/<p class="byline">[\s\S]*?<\/p>/)![0])).toBe(readerText(research));
    expect(html.indexOf('<p class="credit">')).toBeGreaterThan(html.indexOf('<h1 class="title">'));
  });

  test('a byline that no longer opens on the credit stops the page', () => {
    expect(() => storyByline(story.byline.replace('By bleugreen.', 'By bleugreen,'))).toThrow(/does not open 'By bleugreen\.'/);
    expect(() => storyByline('Research by `rune/main`.')).toThrow();
  });

  test('code spans and emphasis are set, not shown as backticks and asterisks', () => {
    for (const [, code] of draft.slice(0, draft.indexOf('## Receipts')).matchAll(/`([^`\n]+)`/g)) {
      expect(html).toContain(`<code>${code!.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}</code>`);
    }
    for (const [, em] of draft.slice(0, draft.indexOf('## Receipts')).matchAll(/(?<!\*)\*([^*\s](?:[^*\n]*[^*\s])?)\*/g)) {
      expect(html).toContain(`<em>${em}</em>`);
    }
    expect(surface).not.toContain('`');
  });

  test('an editorial bracket in a quotation is set as written, and a markdown link is still refused', () => {
    const corrected = 'The record is [3 hours 59 minutes], held by stunbaron…';
    expect(inlineTokens(corrected)).toEqual([{ kind: 'text', text: corrected }]);
    expect(() => inlineTokens('the [talk](https://example.com)')).toThrow();
  });

  test('the title and every section title', () => {
    const headings = lines.slice(0, receiptsAt).filter((l) => /^#( |# \d+\. )/.test(l));
    expect(headings.length).toBe(1 + SECTION_META.length);
    for (const h of headings) expect(surface.includes(h.replace(/^#+ (\d+\. )?/, ''))).toBe(true);
  });

  test('the operator narrates: the byline names the site’s author first and credits the documenting thread in code style', () => {
    expect(story.byline.startsWith(`By ${AUTHOR.name}.`)).toBe(true);
    expect(story.byline).toContain('`rune/main`');
    expect(html).toContain('<code>rune/main</code>');
  });

  test('the reader line above the rule is not page copy', () => {
    const readerLine = lines.slice(0, rule).find((l) => l.startsWith('Draft v'))!;
    expect(text.includes(readerLine.slice(0, 40))).toBe(false);
  });
});

describe('sources', () => {
  const receipts = blocksOf(lines.slice(receiptsAt + 1));

  test('every section closes with one closed Sources disclosure', () => {
    const details = sectionsHtml.match(/<details[^>]*>/g) ?? [];
    expect(details.length).toBe(SECTION_META.length);
    for (const d of details) expect(d).not.toContain('open');
    expect(sectionsHtml.match(/<summary>Sources<\/summary>/g)?.length).toBe(SECTION_META.length);
  });

  test('the hero tree leads the page, with one closed Sources disclosure in plain words', () => {
    expect(html.indexOf(hero)).toBeLessThan(html.indexOf('<h1'));
    const details = hero.match(/<details[^>]*>/g) ?? [];
    expect(details.length).toBe(1);
    expect(details[0]).not.toContain('open');
    expect(hero).toContain('<summary>Sources</summary>');
    expect(decode(hero)).toContain('A language model read each message’s opening');
    expect(hero).not.toMatch(/cairn:|\d:\d\d|\bPDT\b/);
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

  test('the only outbound links are the credit’s and the ones the sections declare, each in its section’s sources', () => {
    const hrefs = [...html.matchAll(/<a href="(http[^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([CREDIT.link.href, ...SECTION_META.flatMap((s) => s.links.map((l) => l.href))]);
    SECTION_META.forEach((s, i) => {
      for (const l of s.links) expect(story.sections[i]!.sources.some((line) => line.includes(l.href))).toBe(true);
    });
  });

  test('quoted messages render as quotations, never as margin quotes', () => {
    const quotes = story.sections.flatMap((s) => s.blocks.filter((b) => b.kind === 'quote'));
    expect(html.match(/<blockquote class="quotation">/g)?.length).toBe(quotes.length);
  });

  test('every figure the page places, and no other', () => {
    const placed = SECTION_META.reduce((n, s) => n + s.figures.length, 0);
    expect(sectionsHtml.match(/<figure/g)?.length).toBe(placed);
    expect(hero.match(/<figure/g)?.length).toBe(1);
  });

  test('the death section sets the body among the spiders after the death, its timeline before the recovery, the re-kit after it, the Agility clip after host’s #1, and the hiscore board after the texts to the operator’s brother', () => {
    const s = sections.find((x) => x.id === 'the-death')!;
    const placed = [...s.figuresAt].sort(([a], [b]) => a - b).flatMap(([at, fs]) => fs.map((f) => ({ at, f })));
    expect(placed.map(({ f }) => (f.kind === 'clip' ? f.id : f.kind))).toEqual(['spider-death', 'timeline', 'finish-rekit', 'finish-agility99', 'image']);
    const [spiders, death, rekit, agility, board] = placed;
    // The replay follows the death, not the sentence that first stands the body among the spiders:
    // the ruling and the logout order come between, and the replay starts after both.
    const died = s.blocks[spiders!.at]!;
    expect(died.kind === 'p' && died.text.includes('In less than a minute, `cairnmax20x` was dead')).toBe(true);
    expect(quotes(s.blocks[spiders!.at + 1]!, 'Welp there goes the run')).toBe(true);
    expect(quotes(s.blocks[death!.at]!, 'we’re not done until #1')).toBe(true);
    expect(death!.f).toEqual({ kind: 'timeline', crop: ['2026-10-26T03:00Z', '2026-10-26T11:30Z'] });
    expect(death!.at + 1).toBe(rekit!.at);
    const recovery = s.blocks[rekit!.at]!;
    expect(recovery.kind === 'p' && recovery.text.startsWith('Overnight the helpers rebuilt the lost kit')).toBe(true);
    // Agility 99 is in the paragraph that closes on a colon before host's verification, so its clip
    // follows that quotation.
    const climb = s.blocks[agility!.at - 1]!;
    expect(climb.kind === 'p' && climb.text.includes('reached Agility 99, the final skill, at 4:07 AM')).toBe(true);
    expect(quotes(s.blocks[agility!.at]!, 'OFFICIAL #1 VERIFIED')).toBe(true);
    expect(board!.at).toBeGreaterThan(agility!.at);
  });

  test('the swarm section closes on the cost link, after host’s answer, not between the usage limits and the quotation they lead into', () => {
    const s = sections.find((x) => x.id === 'the-swarm')!;
    const placed = [...s.figuresAt].flatMap(([at, fs]) => fs.map((f) => ({ at, f })));
    expect(placed.map(({ f }) => f.kind)).toEqual(['cost']);
    const at = placed[0]!.at;
    expect(at).toBe(s.blocks.length - 1);
    expect(quotes(s.blocks[at]!, 'Not exactly. Those are written handoffs, not a direct view of my internal reasoning.')).toBe(true);
  });

  test('the final run section sets the stop at the spiders after the quotation its paragraph introduces, and no Dragon Slayer stop, which it does not narrate', () => {
    const s = sections.find((x) => x.id === 'twenty-eight-hours')!;
    const placed = [...s.figuresAt].sort(([a], [b]) => a - b).flatMap(([at, fs]) => fs.map((f) => ({ at, f })));
    expect(placed.map(({ f }) => (f.kind === 'clip' ? f.id : f.kind))).toEqual(['timeline', 'spider-stop']);
    const [, spiders] = placed;
    expect(quotes(s.blocks[spiders!.at]!, 'wall clock is free, ticks are not')).toBe(true);
    const narrated = s.blocks[spiders!.at - 1]!;
    expect(narrated.kind === 'p' && narrated.text.includes('just before the spiders where it was supposed to finish combat skills, it stopped again')).toBe(true);
  });

  test('the tricks section sets the wine on screen after the sentence that tells it, then the link to the tricks page', () => {
    const s = sections.find((x) => x.id === 'the-tricks')!;
    const placed = [...s.figuresAt].flatMap(([at, fs]) => fs.map((f) => ({ at, f })));
    expect(placed.map(({ f }) => (f.kind === 'clip' ? (f.id ?? 'tricks link') : f.kind))).toEqual(['wine-relog', 'tricks link']);
    const told = s.blocks[placed[0]!.at]!;
    expect(told.kind === 'p' && told.text.includes('wine left in the bank ferments on a timer')).toBe(true);
  });

  test('the attempts section sets attempt 4’s death after the quotation its paragraph introduces', () => {
    const s = sections.find((x) => x.id === 'four-attempts')!;
    const placed = [...s.figuresAt].flatMap(([at, fs]) => fs.map((f) => ({ at, f })));
    const clip = placed.find(({ f }) => f.kind === 'clip' && f.id === 'attempt-4-death')!;
    expect(quotes(s.blocks[clip.at]!, 'ok fine one more attempt')).toBe(true);
    const narrated = s.blocks[clip.at - 1]!;
    expect(narrated.kind === 'p' && narrated.text.includes('It died at the door of the Grand Tree')).toBe(true);
  });

  test('the hiscore board closes the story, after the texts that sent it, its files match it, and its caption reads in Pacific with no zone', () => {
    const s = sections.find((x) => x.id === 'the-death')!;
    expect(s).toBe(sections.at(-1)!);
    const [at, fs] = [...s.figuresAt].find(([, f]) => f.some((x) => x.kind === 'image'))!;
    const image = fs.at(-1)!;
    if (image.kind !== 'image') throw new Error('the board is not the last figure after its block');
    expect(at).toBe(s.blocks.length - 1);
    expect(quotes(s.blocks[at]!, 'Im da king of runescape')).toBe(true);
    const sent = s.blocks[at - 1]!;
    expect(sent.kind === 'p' && sent.text === 'At 4:30 AM I sent my brother a screenshot of the hiscores:').toBe(true);

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
