import { describe, expect, test } from 'bun:test';
import { readFileSync, statSync } from 'node:fs';
import { recordFacts } from './attempts/model';
import { NAV } from './components/Layout';
import { buildCostModel } from './cost/model';
import { costInputs } from './data/cost';
import { timeline } from './data/timeline';
import { fmtInt, fmtUsd } from './lib/numbers';
import { fmtDuration } from './lib/time';
import { AUTHOR, HEAD_MARKER, ORIGIN, PAGE_PATHS, SHARE_IMAGE, SITE_NAME, applyPageMeta, metaFor, pageFile, siteMeta, withHead, type PageMeta } from './meta';
import { story } from './story/story';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const meta = siteMeta();
const shell = read('index.html');

const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** A built page's head as a link unfurler reads it: the title, the canonical link and every meta tag by name or property. */
function head(html: string) {
  const h = html.slice(0, html.indexOf('</head>'));
  const tags = new Map<string, string[]>();
  for (const [, key, value] of h.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)"/g)) {
    tags.set(key!, [...(tags.get(key!) ?? []), unescape(value!)]);
  }
  return {
    titles: [...h.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => unescape(m[1]!)),
    canonical: [...h.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]),
    one: (key: string) => {
      expect(tags.get(key)?.length ?? 0).toBe(1);
      return tags.get(key)![0]!;
    },
    all: (key: string) => tags.get(key) ?? [],
    urls: [...h.matchAll(/(?:href|content)="(https?:[^"]*)"/g)].map((m) => m[1]!),
  };
}

/** The PNG's IHDR: width and height, big-endian, at bytes 16 and 20. */
function pngSize(path: string): [number, number] {
  const png = readFileSync(new URL(path, root));
  expect([...png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

describe('one title and description per page', () => {
  test('the pages are the ones the nav links', () => {
    expect([...PAGE_PATHS]).toEqual(NAV.map((n) => n.to));
  });

  test('the home page is titled as the story is', () => {
    const draftTitle = read('data/story.md').split('\n')[0]!.replace(/^# /, '');
    expect(meta['/'].title).toBe(story.title);
    expect(meta['/'].title).toBe(draftTitle);
  });

  test('every other page is titled by its nav label and the site', () => {
    for (const n of NAV.slice(1)) expect(meta[n.to].title).toBe(`${n.label} · ${SITE_NAME}`);
  });

  test('the home description is the approved line, and its figures agree with the story and the record', () => {
    expect(meta['/'].description).toBe(
      'Five days, one agent swarm, and the #1 time to 99 in every skill on RuneScape for agents: 3 hours 58 minutes of play. ' +
        'The story, the route, the tricks and the cost, told from the run’s own records.',
    );
    // The hiscore's time: 35,787 logged-in ticks at 400 ms, 3 h 58 min 34 s.
    const r = recordFacts(timeline);
    expect(fmtDuration(r.final * r.tickMs, true)).toBe('3 h 58 min 34 s');
    // 'Five days' is the story's own count, from the first message to the #1.
    const opening = story.sections[0]!.blocks.find((b) => b.kind === 'p' && b.text.startsWith('Five days,'));
    expect(opening).toBeDefined();
  });

  test('every other page is described in one plain sentence of at most 155 characters', () => {
    for (const p of PAGE_PATHS.slice(1)) {
      const d = meta[p].description;
      expect(d.length).toBeLessThanOrEqual(155);
      expect(d.endsWith('.')).toBe(true);
      expect(d.slice(0, -1)).not.toMatch(/[.!?] /);
    }
  });

  test('the figures the descriptions state are the pages’ own', () => {
    const cost = buildCostModel(costInputs, timeline);
    expect(meta['/cost'].description).toContain(`${fmtUsd(cost.total)} of tokens at list price, on ${fmtUsd(cost.subscription.prorated)} of subscriptions`);
    expect(meta['/route'].description).toContain(`from tick 0 to ${fmtInt(recordFacts(timeline).final)}`);
    for (const p of ['/tricks', '/harness'] as const) expect(meta[p].description).not.toMatch(/\d/);
  });

  test('the story is the article; the other pages are the site', () => {
    expect(PAGE_PATHS.map((p) => meta[p].type)).toEqual(['article', 'website', 'website', 'website', 'website']);
  });
});

describe('each page’s built head', () => {
  test.each(PAGE_PATHS.map((p) => [p, meta[p]] as const))('%s', (p, m) => {
    const html = withHead(shell, m);
    const h = head(html);
    const url = ORIGIN + p;
    expect(h.titles).toEqual([m.title]);
    expect(h.one('description')).toBe(m.description);
    expect(h.one('author')).toBe('bleugreen');
    // Open Graph's article type names its author; the website type and X's card have no field for one.
    expect(h.all('article:author')).toEqual(p === '/' ? ['https://bleu.green'] : []);
    expect(h.all('twitter:creator')).toEqual([]);
    expect(h.canonical).toEqual([url]);
    expect(h.one('og:type')).toBe(m.type);
    expect(h.one('og:site_name')).toBe('rune.fast');
    expect(h.one('og:title')).toBe(m.title);
    expect(h.one('og:description')).toBe(m.description);
    expect(h.one('og:url')).toBe(url);
    expect(h.one('og:image')).toBe(`${ORIGIN}${SHARE_IMAGE.path}`);
    expect(h.one('og:image:width')).toBe('1200');
    expect(h.one('og:image:height')).toBe('630');
    expect(h.one('og:image:alt')).toBe(SHARE_IMAGE.alt);
    expect(h.one('twitter:card')).toBe('summary_large_image');
    expect(h.one('twitter:title')).toBe(m.title);
    expect(h.one('twitter:description')).toBe(m.description);
    expect(h.one('twitter:image')).toBe(`${ORIGIN}${SHARE_IMAGE.path}`);
    expect(h.one('twitter:image:alt')).toBe(SHARE_IMAGE.alt);
    // Every URL is the site's, but the story's author's.
    expect(h.urls.filter((u) => !u.startsWith('https://rune.fast/'))).toEqual(p === '/' ? [AUTHOR.url] : []);
    // Still the shell: the marker is spent, and the app's root and entry are untouched.
    expect(html).not.toContain(HEAD_MARKER);
    expect(html.slice(html.indexOf('</head>'))).toBe(shell.slice(shell.indexOf('</head>')));
  });

  test('each page has its own file, where Pages serves it without a redirect', () => {
    expect(PAGE_PATHS.map(pageFile)).toEqual(['index.html', 'route.html', 'tricks.html', 'cost.html', 'harness.html']);
  });

  test('the shell must carry the marker exactly once', () => {
    expect(() => withHead('<head></head>', meta['/'])).toThrow();
    expect(() => withHead(`<head>${HEAD_MARKER}${HEAD_MARKER}</head>`, meta['/'])).toThrow();
  });

  test('the shell carries no title or description of its own for the build to duplicate', () => {
    expect(shell).not.toContain('<title');
    expect(shell).not.toContain('name="description"');
  });
});

describe('in the browser', () => {
  test('a path finds its page, with or without a trailing slash; any other path none', () => {
    expect(metaFor('/')).toBe(meta['/']);
    expect(metaFor('/route')).toBe(meta['/route']);
    expect(metaFor('/harness/')).toBe(meta['/harness']);
    expect(metaFor('/nope')).toBeNull();
    expect(metaFor('/route/deeper')).toBeNull();
  });

  test('the document takes the page’s title and description, creating the description if the shell has none', () => {
    const els: { name?: string; content?: string }[] = [];
    const doc = {
      title: '',
      head: { append: (el: (typeof els)[number]) => els.push(el) },
      querySelector: () => els.find((e) => e.name === 'description') ?? null,
      createElement: () => ({ setAttribute(this: Record<string, string>, k: string, v: string) { this[k] = v; } }),
    };
    const run = (m: PageMeta) => applyPageMeta(doc as unknown as Document, m);
    for (const m of [meta['/route'], meta['/cost']]) {
      run(m);
      expect(doc.title).toBe(m.title);
      expect(els.map((e) => e.content)).toEqual([m.description]);
    }
  });
});

describe('the share image and the icons', () => {
  test('the share image is 1200 by 630 and under 300 KB', () => {
    expect(pngSize(`public${SHARE_IMAGE.path}`)).toEqual([SHARE_IMAGE.width, SHARE_IMAGE.height]);
    expect(statSync(new URL(`public${SHARE_IMAGE.path}`, root)).size).toBeLessThan(300 * 1024);
  });

  test('the shell links the SVG icon, its 32 px PNG and the 180 px touch icon, and each is there', () => {
    expect(shell).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    expect(shell).toContain('<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />');
    expect(shell).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(read('public/favicon.svg')).toStartWith('<svg');
    expect(pngSize('public/favicon-32.png')).toEqual([32, 32]);
    expect(pngSize('public/apple-touch-icon.png')).toEqual([180, 180]);
  });
});
