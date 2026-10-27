import raw from '../../data/harness.json';
import type { HarnessData } from './types';

/** In the site build this is the public projection; vite.config.ts rewrites the import (scripts/public-harness.ts). */
export const harnessData = raw as unknown as HarnessData;
