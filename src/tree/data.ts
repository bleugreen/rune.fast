import raw from '../../data/tree.json';
import type { TreeData } from './types';

/** In the site build this is the public projection; vite.config.ts rewrites the import (scripts/public-tree.ts). */
export const treeData = raw as unknown as TreeData;
