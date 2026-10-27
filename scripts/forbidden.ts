/**
 * Identifiers that must never be published, by what they are. Shared by the dist/ scan
 * (check-public.ts) and the replay clip scan (world/redact.ts).
 */
export const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ['fleet helper or test account', /\bcairn_[a-z][a-z0-9]*/],
  ['lab account', /\bdr\d{4}[a-z]\b/],
  // The run host's name, not the town: the story says where it sat (Ashburn, Virginia).
  ['machine hostname', /\bbgsrv|\brs-ashburn|\.ts\.net\b|\.local\b/i],
  ['game-process token', /\bmv[a-z0-9]{6}\b/],
  ['home directory path', /\/Users\/|\/home\//],
  ['message id field', /msg_id/],
  ['cairn address', /cairn:\/\//],
  ['IPv4 address', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
];

/**
 * Whether the address that ends just before `at` goes on: a character that can continue an address
 * does, so an exempt address never matches a prefix of a longer one; punctuation such as a full
 * stop continues it only when more of the address follows ('cairn://p/rs/843.' ends a sentence).
 */
function continues(text: string, at: number): boolean {
  const next = text.charAt(at);
  if (/[\w\-/~=&%#]/.test(next)) return true;
  return /[.?:]/.test(next) && /[\w\-/~]/.test(text.charAt(at + 1));
}

/**
 * `text` with every whole occurrence of the given addresses blanked, longest first. Only the
 * dist/ scan uses it, with the harness page's taught addresses (src/harness/addresses.ts);
 * the replay clip scan keeps the blanket rule.
 */
export function withoutAddresses(text: string, addresses: readonly string[]): string {
  let out = text;
  for (const a of [...addresses].sort((x, y) => y.length - x.length)) {
    let at = out.indexOf(a);
    while (at >= 0) {
      if (continues(out, at + a.length)) at = out.indexOf(a, at + 1);
      else {
        out = out.slice(0, at) + ' '.repeat(a.length) + out.slice(at + a.length);
        at = out.indexOf(a, at + a.length);
      }
    }
  }
  return out;
}

/** The first forbidden identifier in `text`, with its index, if any. */
export function findForbidden(text: string): { what: string; index: number } | undefined {
  for (const [what, re] of FORBIDDEN) {
    const m = re.exec(text);
    if (m) return { what, index: m.index };
  }
  return undefined;
}
