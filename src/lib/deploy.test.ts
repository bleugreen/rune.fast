import { describe, expect, test } from 'bun:test';
import { RELOAD_GRACE_MS, deployRecovery, entryModule, isStaleAssetError, type RecoveryEnv } from './deploy';

/** A tab: its session storage survives its reloads, and the reloads are counted. */
function tab(overrides: Partial<RecoveryEnv> = {}) {
  const store = new Map<string, string>();
  const state = { reloads: 0, now: 1_000_000 };
  const env: RecoveryEnv = {
    storage: () => ({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) }),
    reload: () => void state.reloads++,
    now: () => state.now,
    online: () => true,
    ...overrides,
  };
  /** The page after a reload: same storage, fresh module state. */
  const load = () => deployRecovery(env);
  return { state, load };
}

describe('reload once for a new deploy', () => {
  test('the first failure reloads; the same failure after that reload does not', () => {
    const t = tab();
    const first = t.load();
    expect(first.reload()).toBe(true);
    expect(t.state.reloads).toBe(1);

    t.state.now += 3_000;
    const second = t.load();
    expect(second.canReload()).toBe(false);
    expect(second.reload()).toBe(false);
    expect(t.state.reloads).toBe(1);
  });

  test('a later deploy reloads the tab again', () => {
    const t = tab();
    t.load().reload();
    t.state.now += RELOAD_GRACE_MS + 1;
    expect(t.load().reload()).toBe(true);
    expect(t.state.reloads).toBe(2);
  });

  test('failures while a reload is under way do not reload twice', () => {
    const t = tab();
    const page = t.load();
    expect(page.reload()).toBe(true);
    expect(page.reload()).toBe(true);
    expect(page.reloading).toBe(true);
    expect(t.state.reloads).toBe(1);
  });

  test('no reload without storage to guard it, or while offline', () => {
    const blocked = tab({ storage: () => { throw new Error('SecurityError'); } });
    expect(blocked.load().reload()).toBe(false);
    expect(blocked.state.reloads).toBe(0);

    const offline = tab({ online: () => false });
    expect(offline.load().reload()).toBe(false);
    expect(offline.state.reloads).toBe(0);
  });
});

describe('stale asset errors', () => {
  test('the browsers\' wording for a chunk that did not load', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://rune.fast/assets/MomentPage-OLDHASH0.js',
      'Importing a module script failed.',
      "'text/html' is not a valid JavaScript MIME type.",
      'error loading dynamically imported module: https://rune.fast/assets/MomentPage-OLDHASH0.js',
      'Unable to preload CSS for /assets/MomentPage-OLD.css',
    ]) {
      expect(isStaleAssetError(new TypeError(message))).toBe(true);
    }
  });

  test('other errors are not', () => {
    expect(isStaleAssetError(new TypeError("Cannot read properties of undefined (reading 'k')"))).toBe(false);
    expect(isStaleAssetError('Importing a module script failed.')).toBe(false);
  });
});

test("the entry module names a page's build", () => {
  const built = '<head><script type="module" crossorigin src="/assets/index-D7DYvh6d.js"></script><link rel="stylesheet" href="/assets/index.css"></head>';
  expect(entryModule(built)).toBe('/assets/index-D7DYvh6d.js');
  expect(entryModule('<script>1</script><script crossorigin src="/a.js" type="module"></script>')).toBe('/a.js');
  expect(entryModule('<div id="root"></div>')).toBeUndefined();
});
