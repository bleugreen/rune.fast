import raw from '../../data/attempts-timeline.json';
import type { Timeline } from './types';

/** In the site build this is the public projection; vite.config.ts rewrites the import. */
export const timeline = raw as unknown as Timeline;
