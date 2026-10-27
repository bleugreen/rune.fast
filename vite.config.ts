import { defineConfig, mergeConfig, type Plugin, type Rollup, type UserConfig } from 'vite';
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
import { NOT_FOUND, PAGE_ONLY, type PrerenderedPath } from './src/lib/site';

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
 * The lazily loaded module each page's first screen needs: the story's run tree data
 * (src/tree/data.ts), and every other page's own chunk, as src/routes.tsx loads it.
 */
const PAGE_CHUNKS: Readonly<Record<PrerenderedPath, string>> = {
  '/': '/data/tree.json',
  '/route': '/src/pages/RoutePage.tsx',
  '/tricks': '/src/pages/TricksPage.tsx',
  '/cost': '/src/pages/CostPage.tsx',
  '/harness': '/src/pages/HarnessPage.tsx',
  [NOT_FOUND]: '/src/pages/NotFound.tsx',
};

/**
 * Each page's HTML preloads its chunk (PAGE_CHUNKS) and the chunks it imports, and links their
 * stylesheets, so they download beside the entry rather than once the entry has run, and the
 * prerendered page is styled from its first paint. Written into the shell marked for its page
 * alone; withHead (src/meta.ts) drops each from every other page's HTML. Vite's own loader finds
 * them in the document when the router imports the chunk, and fetches none of them again.
 */
function pagePreloads(): Plugin {
  return {
    name: 'rune:page-preloads',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const chunks = Object.values(ctx.bundle ?? {}).filter((c): c is Rollup.OutputChunk => c.type === 'chunk');
        const byFile = new Map(chunks.map((c) => [c.fileName, c]));
        /** A chunk's static imports, and theirs. */
        const imported = (c: Rollup.OutputChunk, into = new Set<string>()): Set<string> => {
          for (const f of c.imports) if (!into.has(f) && into.add(f)) imported(byFile.get(f)!, into);
          return into;
        };
        const entry = chunks.find((c) => c.isEntry);
        if (!entry) throw new Error('rune:page-preloads: the bundle has no entry');
        const inEntry = imported(entry, new Set([entry.fileName]));
        return Object.entries(PAGE_CHUNKS).flatMap(([page, module]) => {
          const chunk = chunks.find((c) => c.facadeModuleId?.endsWith(module));
          if (!chunk) throw new Error(`rune:page-preloads: no chunk is ${module}, which the ${page} page's first screen needs`);
          const js = [chunk.fileName, ...imported(chunk)].filter((f) => !inEntry.has(f));
          const css = js.flatMap((f) => [...(byFile.get(f)!.viteMetadata?.importedCss ?? [])]);
          return [
            ...css.map((f) => ({ tag: 'link', attrs: { rel: 'stylesheet', crossorigin: true, href: `/${f}`, [PAGE_ONLY]: page }, injectTo: 'head' as const })),
            ...js.map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${f}`, [PAGE_ONLY]: page }, injectTo: 'head' as const })),
          ];
        });
      },
    },
  };
}

const site: UserConfig = {
    // .world/ holds the local cache copy and clip output; never under public/, so never in dist/.
    plugins: [publicData(), story(), worldAssets('.world'), pagesRoutesFile(), pagePreloads()],
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
    /*
     * The server entry, built in the same run as the client and through the same plugins and
     * defines (the projections, the story, the build date, the CSS module names), so what it
     * renders is what the client's first render draws. scripts/page-heads.ts renders the pages
     * with it; it is never deployed.
     */
    environments: {
      ssr: {
        build: {
          outDir: 'dist-server',
          emptyOutDir: true,
          copyPublicDir: false,
          rollupOptions: { input: { server: 'src/server.tsx' } },
        },
      },
    },
    builder: {
      async buildApp(builder) {
        await builder.build(builder.environments.client!);
        await builder.build(builder.environments.ssr!);
      },
    },
};

export default defineConfig(mergeConfig(worldViteConfig(), site));
