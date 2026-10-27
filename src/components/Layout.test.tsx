import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Nav } from './Layout';

/** NavLink's layout effect does nothing on the server, which is all this needs. */
function render(): string {
  const error = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    error(...args);
  };
  try {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={['/route']}>
        <Nav />
      </MemoryRouter>,
    );
  } finally {
    console.error = error;
  }
}

describe('the nav', () => {
  const html = render();
  const labels = [...html.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);

  test('links every live page, the Route page among them', () => {
    expect(labels).toEqual(['Story', 'Attempts', 'Route', 'Tricks', 'Cost', 'Harness']);
    expect(html).toContain('href="/route"');
  });

  test('marks the page it is on', () => {
    expect(html).toMatch(/<a [^>]*class="current"[^>]*href="\/route"|<a [^>]*href="\/route"[^>]*class="current"/);
  });

  test('carries no “soon” entries', () => {
    expect(html.toLowerCase()).not.toContain('soon');
    expect(readFileSync('src/components/Layout.tsx', 'utf8').toLowerCase()).not.toContain('soon');
    expect(readFileSync('src/components/Layout.module.css', 'utf8').toLowerCase()).not.toContain('soon');
  });
});
