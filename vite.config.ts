import { defineConfig, type Plugin } from 'vite';
import { projectTimeline } from './scripts/public-timeline';
import { projectCostData, projectRoles } from './scripts/public-cost';

/** Archival exports in data/, by path suffix, and the public projection that replaces each in the build. */
const PROJECTIONS: ReadonlyArray<readonly [string, (raw: never) => unknown]> = [
  ['/data/attempts-timeline.json', projectTimeline],
  ['/data/cost-data.json', projectCostData],
  ['/data/roles.json', projectRoles],
];

/**
 * The files in data/ are kept verbatim as exported; what reaches the browser is
 * their public projection (see scripts/public-timeline.ts and scripts/public-cost.ts).
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

export default defineConfig({
  plugins: [publicData()],
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
