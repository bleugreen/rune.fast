/// <reference types="vite/client" />

/** UTC date of the build, YYYY-MM-DD; injected by vite.config.ts. */
declare const __BUILD_DATE__: string;

/** data/story.md, loaded as its parsed page copy (scripts/story-module.ts); typed in src/story/story.ts. */
declare module '*/data/story.md' {
  const story: unknown;
  export default story;
}
