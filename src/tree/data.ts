import raw from '../../data/tree.json';
import type { TreeData, TreeTitles } from './types';

/** In the site build this is the public projection; vite.config.ts rewrites the import (scripts/public-tree.ts). */
export const treeData = raw as unknown as TreeData;

let titles: Promise<TreeTitles> | undefined;

/** The issue titles, in their own chunk: fetched on the first hover or tap, never on first paint. */
export function loadTitles(): Promise<TreeTitles> {
  titles ??= import('../../data/tree-titles.json').then((m) => m.default as unknown as TreeTitles);
  return titles;
}
