import { defineConfig, mergeConfig, type Plugin, type UserConfig } from 'vite';
// Relative, so Vite bundles it into the config: Node would load the package's .ts raw.
import { worldAssets, worldViteConfig } from './packages/world/vite';
import { projectTimeline } from './scripts/public-timeline';
import { projectCostData, projectRoles } from './scripts/public-cost';
import { projectTricks } from './scripts/public-tricks';
import { projectHarness } from './scripts/public-harness';
import { projectRouteLog, projectRoutePlan } from './scripts/public-route';
import { projectTree } from './scripts/public-tree';
import { isStoryMd, storyModule } from './scripts/story-module';
import { pagesRoutesFile } from './scripts/pages-routes';
import { pacificDayKey } from './src/lib/time';
import { PAGE_ONLY } from './src/lib/head';

/** Archival exports in data/, by path suffix, and the public projection that replaces each in the build. */
const PROJECTIONS: ReadonlyArray<readonly [string, (raw: never) => unknown]> = [
  ['/data/attempts-timeline.json', projectTimeline],
  ['/data/cost-data.json', projectCostData],
  ['/data/roles.json', projectRoles],
  ['/data/tricks.json', projectTricks],
  ['/data/harness.json', projectHarness],
  ['/data/route-log.json', projectRouteLog],
  ['/data/route-plan.json', projectRoutePlan],
  ['/data/tree.json', projectTree],
];

/**
 * The files in data/ are kept verbatim as exported; what reaches the browser is
 * their public projection (see scripts/public-timeline.ts, scripts/public-cost.ts,
 * scripts/public-tricks.ts and scripts/public-harness.ts).
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

/**
 * The story page's HTML preloads the run tree's data chunk (src/tree/data.ts), so it downloads
 * beside the entry rather than once the entry has run. Written into the shell marked for the story
 * page alone; withHead (src/meta.ts) drops it from every other page's HTML.
 */
function treePreload(): Plugin {
  return {
    name: 'rune:tree-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const chunk = Object.values(ctx.bundle ?? {}).find((c) => c.type === 'chunk' && c.facadeModuleId?.endsWith('/data/tree.json'));
        if (!chunk) throw new Error('rune:tree-preload: no chunk holds data/tree.json');
        return [{ tag: 'link', attrs: { rel: 'modulepreload', href: `/${chunk.fileName}`, [PAGE_ONLY]: '/' }, injectTo: 'head' }];
      },
    },
  };
}

const site: UserConfig = {
    // .world/ holds the local cache copy and clip output; never under public/, so never in dist/.
    plugins: [publicData(), story(), worldAssets('.world'), pagesRoutesFile(), treePreload()],
    resolve: { dedupe: ['react', 'react-dom'] },
    define: {
      __BUILD_DATE__: JSON.stringify(pacificDayKey(Date.now())),
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
};

export default defineConfig(mergeConfig(worldViteConfig(), site));
