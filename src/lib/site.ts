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
