/*
 * Facts about the site that the entry needs without loading src/meta.ts, which works out every
 * page's description from the data and models (the cost model among them).
 */

/** Who runs the site: named in every page's footer and head. */
export const AUTHOR = { name: 'bleugreen', url: 'https://bleu.green' } as const;

/**
 * The attribute that marks a tag of the built shell's head as one page's alone, by its path: the
 * build writes such tags (vite.config.ts) and withHead (src/meta.ts) keeps each in its page's HTML only.
 */
export const PAGE_ONLY = 'data-page';

export const PAGE_PATHS = ['/', '/route', '/tricks', '/cost', '/harness'] as const;
export type PagePath = (typeof PAGE_PATHS)[number];

/** Every path that is no page, as the router's catch-all names it: the 'Nothing here' page. */
export const NOT_FOUND = '*';
export type PrerenderedPath = PagePath | typeof NOT_FOUND;

/** The page a client-side path is, if it is one: '/route' and '/route/' are the Route page. */
export function pageAt(pathname: string): PagePath | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return (PAGE_PATHS as readonly string[]).includes(path) ? (path as PagePath) : null;
}

/** The page whose prerendered HTML a path is drawn as: its own, or for any other path, Nothing here's. */
export const prerenderedAt = (pathname: string): PrerenderedPath => pageAt(pathname) ?? NOT_FOUND;
