import { isStaleAssetError, recovery } from '../lib/deploy';
import type { TreeData } from './types';

/**
 * The tree's data, in a chunk of its own: it is the largest data on the site, so the page's text
 * paints without waiting for it, and the figure, whose height is reserved, draws when it arrives.
 * In the site build the import is the public projection; vite.config.ts rewrites it
 * (scripts/public-tree.ts). A chunk gone with a deploy since the tab opened reloads the tab once.
 */
export function loadTreeData(): Promise<TreeData> {
  return import('../../data/tree.json').then(
    (m) => m.default as unknown as TreeData,
    (e: unknown) => {
      if (isStaleAssetError(e)) recovery.reload();
      throw e;
    },
  );
}
