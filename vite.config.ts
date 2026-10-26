import { defineConfig, type Plugin } from 'vite';
import { projectTimeline } from './scripts/public-timeline';

/**
 * data/attempts-timeline.json is kept verbatim as exported; what reaches the
 * browser is its public projection (see scripts/public-timeline.ts).
 */
function publicTimeline(): Plugin {
  return {
    name: 'rune:public-timeline',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0]!.endsWith('/data/attempts-timeline.json')) return null;
      return { code: JSON.stringify(projectTimeline(JSON.parse(code))), map: null };
    },
  };
}

export default defineConfig({
  plugins: [publicTimeline()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
});
