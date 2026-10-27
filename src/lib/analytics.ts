/** The hosts that count: the site itself, never dev, `vite preview` or a *.pages.dev preview. */
export const ANALYTICS_HOSTS: readonly string[] = ['rune.fast', 'www.rune.fast'];

export const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
/**
 * The token is the rune.fast zone's own Web Analytics site (its automatic setup), which takes
 * reports only at the zone's same-origin endpoint: cloudflareinsights.com/cdn-cgi/rum, where a
 * manual install reports, answers 404 for it. The beacon sends to `send.to` when its config has one.
 */
const TOKEN = '361721d1f0454779b39c00a62bf112a9';
export const RUM_ENDPOINT = '/cdn-cgi/rum';

type AnalyticsWindow = Pick<Window, 'addEventListener' | 'setTimeout'> & {
  location: Pick<Location, 'hostname'>;
  document: Pick<Document, 'readyState' | 'createElement' | 'head'>;
  requestIdleCallback?: Window['requestIdleCallback'];
};

/**
 * Cloudflare Web Analytics, added by the page itself (Cloudflare's manual snippet, in SPA mode so
 * client-side navigations count) once the page has loaded and the main thread is idle. A script in
 * the HTML would hold up DOMContentLoaded, and a network that drops its host would hold the page
 * until the connection timed out; added after load, its failure or slowness touches nothing.
 */
export function startAnalytics(win: AnalyticsWindow = window): void {
  if (!ANALYTICS_HOSTS.includes(win.location.hostname)) return;
  const add = () => {
    const s = win.document.createElement('script');
    s.defer = true;
    s.src = BEACON_SRC;
    s.dataset.cfBeacon = JSON.stringify({ token: TOKEN, spa: true, send: { to: RUM_ENDPOINT } });
    win.document.head.append(s);
  };
  const whenIdle = () => (win.requestIdleCallback ? win.requestIdleCallback(add, { timeout: 5000 }) : win.setTimeout(add, 1));
  if (win.document.readyState === 'complete') whenIdle();
  else win.addEventListener('load', whenIdle, { once: true });
}
