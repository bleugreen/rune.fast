/**
 * Recovering a tab from an earlier deploy. Pages serves only the current deploy's files, so a tab
 * loaded before it asks for chunks, stylesheets and workers by names that are gone (now a 404, see
 * functions/). Reloading picks up the new deploy. A tab that fails again soon after reloading is
 * not reloaded again, so a genuinely broken asset ends on the error page rather than in a loop.
 */

/** How browsers and Vite word a module, stylesheet or worker script that did not load. */
const STALE_ASSET = new RegExp(
  [
    'Failed to fetch dynamically imported module', // Chrome
    'Importing a module script failed', // Safari
    'error loading dynamically imported module', // Firefox
    'is not a valid JavaScript MIME type', // Safari, given HTML in place of a module
    'Failed to load module script', // Chrome, given HTML in place of a module
    'Unable to preload CSS', // Vite's preload helper
  ].join('|'),
  'i',
);

export function isStaleAssetError(error: unknown): boolean {
  return error instanceof Error && STALE_ASSET.test(error.message);
}

const KEY = 'rune.fast:deploy-reload';

/**
 * A failure this soon after the tab's last automatic reload is the same failure, not a newer
 * deploy: long enough for a slow phone to reload and fail again, short of the next deploy.
 */
export const RELOAD_GRACE_MS = 60_000;

export type RecoveryEnv = {
  storage(): Pick<Storage, 'getItem' | 'setItem'>;
  reload(): void;
  now(): number;
  online(): boolean;
};

export type Recovery = {
  /** Whether a reload would be made now. */
  canReload(): boolean;
  /** Reloads to pick up a new deploy, unless this tab just did; true while the reload is under way. */
  reload(): boolean;
  readonly reloading: boolean;
};

export function deployRecovery(env: RecoveryEnv): Recovery {
  let reloading = false;
  const canReload = () => {
    // Offline, the failure is the network's and a reload would only lose the page.
    if (!env.online()) return false;
    try {
      const last = Number(env.storage().getItem(KEY));
      return !(last > 0 && env.now() - last < RELOAD_GRACE_MS);
    } catch {
      // Without storage there is no guard, and an unguarded reload could loop.
      return false;
    }
  };
  return {
    canReload,
    reload() {
      if (reloading) return true;
      if (!canReload()) return false;
      try {
        env.storage().setItem(KEY, String(env.now()));
      } catch {
        return false;
      }
      reloading = true;
      env.reload();
      return true;
    },
    get reloading() {
      return reloading;
    },
  };
}

export const recovery = deployRecovery({
  storage: () => sessionStorage,
  reload: () => location.reload(),
  now: () => Date.now(),
  online: () => navigator.onLine,
});

/** The entry module a page's HTML loads: the build it belongs to. */
export function entryModule(html: string): string | undefined {
  for (const [, attrs] of html.matchAll(/<script\b([^>]*)>/g)) {
    if (!/\btype="module"/.test(attrs!)) continue;
    const src = /\bsrc="([^"]+)"/.exec(attrs!)?.[1];
    if (src) return src;
  }
  return undefined;
}

/**
 * Reloads a tab older than the deploy the site now serves, judged by the entry module its
 * index.html names. For files a tab's code asks for by name only after it has loaded, such as the
 * replay's workers and wasm: a module worker that fails to load fails only the calls already sent
 * to it, and the replay has sent none by then, so it would wait on the gone files forever.
 */
export async function reloadIfRedeployed(): Promise<void> {
  const running = entryModule(document.documentElement.outerHTML);
  try {
    const served = entryModule(await (await fetch('/', { cache: 'no-store' })).text());
    if (running && served && running !== served) recovery.reload();
  } catch {
    // Offline: whatever fails reports itself.
  }
}
