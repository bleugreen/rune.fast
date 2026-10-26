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

/** The first forbidden identifier in `text`, with its index, if any. */
export function findForbidden(text: string): { what: string; index: number } | undefined {
  for (const [what, re] of FORBIDDEN) {
    const m = re.exec(text);
    if (m) return { what, index: m.index };
  }
  return undefined;
}
