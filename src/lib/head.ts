/**
 * The attribute that marks a tag of the built shell's head as one page's alone, by its path: the
 * build writes such tags (vite.config.ts) and withHead (src/meta.ts) keeps each in its page's HTML only.
 */
export const PAGE_ONLY = 'data-page';
