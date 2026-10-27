import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Nav } from './Layout';

describe('the nav', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/route']}>
      <Nav />
    </MemoryRouter>,
  );
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
