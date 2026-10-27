import { plugin } from 'bun';
import { storyModule } from './story-module';

// .env's value: Vite reads it in dev and the build, bun test does not.
process.env.VITE_WORLD_ASSET_BASE ??= '/world-assets/';

/**
 * The loaders Vite provides in the site build, for bun test and for the scripts that read the
 * site's modules outside Vite (the page heads, check:public): the parsed story, and CSS modules
 * as identity maps so components render with their class names.
 */
plugin({
  name: 'rune:test-loaders',
  setup(build) {
    build.onLoad({ filter: /\/data\/story\.md$/ }, async ({ path }) => ({
      contents: storyModule(await Bun.file(path).text(), path).code,
      loader: 'js',
    }));
    build.onLoad({ filter: /\.module\.css$/ }, () => ({
      contents: 'export default new Proxy({}, { get: (_, k) => (typeof k === "string" ? k : undefined) });',
      loader: 'js',
    }));
  },
});
