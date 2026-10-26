import { plugin } from 'bun';
import { storyModule } from './story-module';

/**
 * The loaders Vite provides in the site build, for bun test: the parsed story, and
 * CSS modules as identity maps so components render with their class names.
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
