import { defineConfig, type Plugin } from 'vite';
import { projectTimeline } from './scripts/public-timeline';
import { projectCostData, projectRoles } from './scripts/public-cost';
import { projectTricks } from './scripts/public-tricks';
import { isStoryMd, storyModule } from './scripts/story-module';

/** Archival exports in data/, by path suffix, and the public projection that replaces each in the build. */
const PROJECTIONS: ReadonlyArray<readonly [string, (raw: never) => unknown]> = [
  ['/data/attempts-timeline.json', projectTimeline],
  ['/data/cost-data.json', projectCostData],
  ['/data/roles.json', projectRoles],
  ['/data/tricks.json', projectTricks],
];

/**
 * The files in data/ are kept verbatim as exported; what reaches the browser is
 * their public projection (see scripts/public-timeline.ts, scripts/public-cost.ts
 * and scripts/public-tricks.ts).
 */
function publicData(): Plugin {
  return {
    name: 'rune:public-data',
    enforce: 'pre',
    transform(code, id) {
      const path = id.split('?')[0]!;
      const projection = PROJECTIONS.find(([suffix]) => path.endsWith(suffix));
      if (!projection) return null;
      return { code: JSON.stringify(projection[1](JSON.parse(code) as never)), map: null };
    },
  };
}

/** data/story.md is the narrator's draft verbatim; what reaches the browser is its page copy. */
function story(): Plugin {
  return {
    name: 'rune:story',
    enforce: 'pre',
    transform(code, id) {
      if (!isStoryMd(id)) return null;
      const { code: js, files } = storyModule(code, id.split('?')[0]!);
      files.forEach((f) => this.addWatchFile(f));
      return { code: js, map: null };
    },
  };
}

export default defineConfig({
  plugins: [publicData(), story()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // react-router marks its modules "use client"; meaningless in a client-only bundle.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
