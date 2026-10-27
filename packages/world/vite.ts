import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import type { Plugin, UserConfig } from 'vite';

/** The include syntax ts-shader-loader accepted, which the shaders are written against. */
const INCLUDE = /#include "([./\w_-]+)";/g;

function expandIncludes(file: string, chain: readonly string[], watch: (file: string) => void): string {
  return readFileSync(file, 'utf8').replace(INCLUDE, (_match, rel: string) => {
    const target = resolve(dirname(file), rel);
    if (chain.includes(target)) throw new Error(`#include cycle: ${[...chain, target].join(' -> ')}`);
    watch(target);
    return expandIncludes(target, [...chain, target], watch);
  });
}

/**
 * Loads `.glsl` files as a default-exported string with `#include "./path";` lines expanded
 * recursively, relative to the including file. Queried imports (`?raw`, `?url`) are left to Vite.
 */
export function glslInclude(): Plugin {
  return {
    name: 'rune:glsl-include',
    enforce: 'pre',
    load(id) {
      if (!id.endsWith('.glsl')) return null;
      const code = expandIncludes(id, [id], (file) => this.addWatchFile(file));
      return { code: `export default ${JSON.stringify(code)};`, map: null };
    },
  };
}

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.jsonl': 'application/x-ndjson',
};

/**
 * Serves a local directory at `base` with byte ranges, standing in for the R2 bucket in dev and
 * preview. A request for `x.jsonl` is answered from `x.jsonl.br` with `Content-Encoding: br` when
 * that file exists, which is how the publish script stores chunks and how R2 serves them.
 */
export function worldAssets(dir: string, base = '/world-assets/'): Plugin {
  const root = resolve(dir);
  const handle = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith(base)) return next();
    const rel = decodeURIComponent(req.url.slice(base.length).split('?')[0]!);
    let file = normalize(join(root, rel));
    if (!file.startsWith(root + sep)) return notFound(res);
    let encoding: string | undefined;
    if (existsSync(file + '.br')) {
      file += '.br';
      encoding = 'br';
    }
    if (!existsSync(file) || !statSync(file).isFile()) return notFound(res);
    const size = statSync(file).size;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', CONTENT_TYPES[extname(rel)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    if (encoding) res.setHeader('Content-Encoding', encoding);
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range && !encoding) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.end();
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      if (req.method === 'HEAD') return res.end();
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.setHeader('Content-Length', String(size));
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  };
  return {
    name: 'rune:world-assets',
    configureServer(server) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
  };
}

function notFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.end();
}

const LICENCE_FILES = [
  ['licenses/LICENSE.txt', 'LICENSE'],
  ['licenses/UPSTREAM.md', 'UPSTREAM.md'],
] as const;

/**
 * Publishes the engine's licence and provenance at /licenses/ (emitted into the build, served in
 * dev), so the site can link them.
 */
export function worldLicences(): Plugin {
  const here = dirname(new URL(import.meta.url).pathname);
  return {
    name: 'rune:world-licences',
    generateBundle() {
      for (const [fileName, source] of LICENCE_FILES) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(join(here, source)) });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const entry = LICENCE_FILES.find(([fileName]) => req.url === `/${fileName}`);
        if (!entry) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(join(here, entry[1])));
      });
    },
  };
}

/** Headers that make the page cross-origin isolated, so the worker pool can share the cache. */
export const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const;

/**
 * The parts of a Vite config the engine needs: `.web.ts` modules ahead of their headless twins
 * (Gzip.web.ts is the wasm path), shaders with includes in pages and workers, ES module workers,
 * and cross-origin isolation in dev and preview.
 */
export function worldViteConfig(): UserConfig {
  return {
    plugins: [glslInclude(), worldLicences()],
    resolve: {
      extensions: ['.web.ts', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    },
    worker: {
      format: 'es',
      plugins: () => [glslInclude()],
    },
    server: { headers: ISOLATION_HEADERS },
    preview: { headers: ISOLATION_HEADERS },
  };
}
