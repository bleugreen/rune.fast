/// <reference types="vite/client" />

/** UTC date of the build, YYYY-MM-DD; injected by vite.config.ts. */
declare const __BUILD_DATE__: string;

/** data/story.md, loaded as its parsed page copy (scripts/story-module.ts); typed in src/story/story.ts. */
declare module '*/data/story.md' {
  const story: unknown;
  export default story;
}

interface ImportMetaEnv {
  /** Base URL of the replay's cache store and clips, ending in a slash (.env, .env.production). */
  readonly VITE_WORLD_ASSET_BASE: string;
}
