import raw from '../../data/story.md';
import type { Story } from './draft';

/**
 * The narrator's draft, as page copy. The import is already parsed: the site build
 * and the tests both load data/story.md through scripts/story-module.ts, so the
 * draft's reader line never reaches the bundle.
 */
export const story = raw as Story;
