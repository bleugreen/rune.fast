import { parseStory } from '../src/story/draft';

/**
 * data/story.md as a JS module holding only the parsed page copy. Shared by the
 * Vite plugin (vite.config.ts) and the test preload (scripts/test-preload.ts).
 */
export const isStoryMd = (id: string) => id.split('?')[0]!.endsWith('/data/story.md');

export const storyModule = (md: string) => `export default ${JSON.stringify(parseStory(md))};\n`;
