import { recordFacts } from './attempts/model';
import { buildCostModel } from './cost/model';
import { costInputs } from './data/cost';
import { timeline } from './data/timeline';
import { AUTHOR, PAGE_ONLY } from './lib/site';
import { fmtInt, fmtUsd } from './lib/numbers';
import { inlineTokens } from './story/draft';
import { story } from './story/story';

/*
 * Each page's title and description, and the link-preview head made from them. The one source for
 * both: the browser sets document.title and the description from it on every navigation (Layout),
 * and the build writes it into each page's own HTML (scripts/page-heads.ts), because a link
 * unfurler runs no JavaScript and reads only the HTML it is served.
 */

export const ORIGIN = 'https://rune.fast';
export const SITE_NAME = 'rune.fast';

export const PAGE_PATHS = ['/', '/route', '/tricks', '/cost', '/harness'] as const;
export type PagePath = (typeof PAGE_PATHS)[number];

/** One preview image for every page: public/share.png, shot from the dev-only /share screen by scripts/render-share.ts. */
export const SHARE_IMAGE = {
  path: '/share.png',
  width: 1200,
  height: 630,
  alt: 'The whole run as a tree, from Tuesday 20 October at the top to the #1 on Monday 26 October at the foot, each issue growing from the agent that filed it, beside the story’s title.',
} as const;

export interface PageMeta {
  path: PagePath;
  title: string;
  description: string;
  /** og:type: the story is the article; the other pages are the site's. */
  type: 'article' | 'website';
}

/** The marker in index.html where the build writes a page's head. */
export const HEAD_MARKER = '<!--page-head-->';

/** A prose string as a reader sees it, less its `code` and *emphasis* delimiters. */
const plain = (s: string) =>
  inlineTokens(s)
    .map((t) => t.text)
    .join('');

/** '3 hours 58 minutes': truncated, as the hiscore's time is. */
function hoursMinutes(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const [h, m] = [Math.floor(minutes / 60), minutes % 60];
  return `${h} hour${h === 1 ? '' : 's'} ${m} minute${m === 1 ? '' : 's'}`;
}

let built: Readonly<Record<PagePath, PageMeta>> | null = null;

/** Every page's meta. Its figures are the ones the pages print, from the same data and models. */
export function siteMeta(): Readonly<Record<PagePath, PageMeta>> {
  if (built) return built;
  const record = recordFacts(timeline);
  const cost = buildCostModel(costInputs, timeline);
  const page = (path: PagePath, title: string, description: string): PageMeta => ({ path, title, description, type: 'website' });
  built = {
    '/': {
      path: '/',
      type: 'article',
      title: plain(story.title),
      description:
        `Five days, one agent swarm, and the #1 time to 99 in every skill on RuneScape for agents: ` +
        `${hoursMinutes(record.final * record.tickMs)} of play. The story, the route, the tricks and the cost, told from the run’s own records.`,
    },
    '/route': page(
      '/route',
      `Route · ${SITE_NAME}`,
      `The record run step by step on the hiscore’s own clock, from tick 0 to ${fmtInt(record.final)}: what each step did, why it went there, and what it cost in ticks.`,
    ),
    '/tricks': page(
      '/tricks',
      `Tricks · ${SITE_NAME}`,
      'The techniques that made the run: what the game normally does, what the swarm did instead, why the server allows it, and what the measured ones saved.',
    ),
    '/cost': page(
      '/cost',
      `Cost · ${SITE_NAME}`,
      `What the agent swarm cost: ${fmtUsd(cost.total)} of tokens at list price, on ${fmtUsd(cost.subscription.prorated)} of subscriptions, by day, by model and by kind of agent.`,
    ),
    '/harness': page(
      '/harness',
      `Harness · ${SITE_NAME}`,
      'Cairn, the harness the swarm ran on, for people who use coding agents: how its agents filed issues, messaged each other and asked the operator.',
    ),
  };
  return built;
}

/** The page a client-side path is, if it is one: '/route' and '/route/' are the Route page. */
export function metaFor(pathname: string): PageMeta | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return (PAGE_PATHS as readonly string[]).includes(path) ? siteMeta()[path as PagePath] : null;
}

/** Sets the document's title and description to a page's. */
export function applyPageMeta(doc: Document, m: PageMeta): void {
  doc.title = m.title;
  let description = doc.querySelector('meta[name="description"]');
  if (!description) {
    description = doc.createElement('meta');
    description.setAttribute('name', 'description');
    doc.head.append(description);
  }
  description.setAttribute('content', m.description);
}

/**
 * The file Pages serves a page from: '/route' is route.html. Pages serves a directory index
 * (route/index.html) only at '/route/', and answers '/route' with a redirect there.
 */
export const pageFile = (p: PagePath) => (p === '/' ? 'index.html' : `${p.slice(1)}.html`);

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A page's head: its title, description and author, canonical URL, and the Open Graph and X card
 * tags, every URL absolute. The article (the story) also names its author's URL, as Open Graph's
 * article type defines; the website type and X's card have no author field to fill.
 */
export function headTags(m: PageMeta): string[] {
  const url = ORIGIN + m.path;
  const image = ORIGIN + SHARE_IMAGE.path;
  const [title, description] = [attr(m.title), attr(m.description)];
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="author" content="${attr(AUTHOR.name)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${SHARE_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${SHARE_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${attr(SHARE_IMAGE.alt)}" />`,
    ...(m.type === 'article' ? [`<meta property="article:author" content="${attr(AUTHOR.url)}" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<meta name="twitter:image:alt" content="${attr(SHARE_IMAGE.alt)}" />`,
  ];
}

const pageOnlyTag = new RegExp(`[ \\t]*<[^>]*\\b${PAGE_ONLY}="([^"]*)"[^>]*>\\n?`, 'g');

/**
 * The built shell with a page's head written in at the marker, at the marker's indent, and
 * without the tags marked for another page.
 */
export function withHead(shell: string, m: PageMeta): string {
  const at = shell.indexOf(HEAD_MARKER);
  if (at < 0 || shell.indexOf(HEAD_MARKER, at + 1) >= 0) {
    throw new Error(`page heads: the shell must carry ${HEAD_MARKER} exactly once (index.html)`);
  }
  const indent = /[ \t]*$/.exec(shell.slice(0, at))![0];
  const head = shell.slice(0, at) + headTags(m).join(`\n${indent}`) + shell.slice(at + HEAD_MARKER.length);
  const end = head.indexOf('</head>');
  return head.slice(0, end).replace(pageOnlyTag, (tag, path: string) => (path === m.path ? tag : '')) + head.slice(end);
}
