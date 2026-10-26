/**
 * Sources as a reader can use them. The receipts and dig tables in data/ keep
 * their cairn:// addresses, transcript turns and raw sequence numbers, which are
 * the project's traceability; the page prints none of those (the operator's
 * ruling: they mean nothing to an outsider). What it prints is who said a thing,
 * where in plain terms, and when.
 */

/** Thread and issue addresses in the rs project, in plain words. Longest forms first. */
const PLACES: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:cairn:\/\/p\/)?rs\/(main|host)\/chat(?:\/raw)?(?:\/turn\/\d+)?/g, "$1's thread"],
  [/(?:cairn:\/\/p\/)?rs\/(main|host)\/messages/g, "$1's messages"],
  [/(?:cairn:\/\/p\/)?rs\/main\/db(?: journal)?/g, "main's journal"],
  [/(?:cairn:\/\/p\/)?rs\/document(?:\/db| chat)?/g, "the documenting thread's notes"],
  [/(?:cairn:\/\/p\/)?rs\/tenets\/(\d+)/g, 'rs tenet $1'],
  [/(?:cairn:\/\/p\/)?rs\/(\d+)\/\d+\/builder\/create-pr/g, "issue rs/$1, the builder's pull request"],
  [/(?:cairn:\/\/p\/)?rs\/(\d+)\/\d+\/(\w+)\/chat(?:\/raw)?/g, "issue rs/$1, the $2's thread"],
  [/(?:cairn:\/\/p\/)?rs\/(\d+)\/\d+\/(\w+)\/messages/g, "issue rs/$1, the $2's messages"],
  [/cairn:\/\/p\/rs\/(\d+)/g, 'issue rs/$1'],
  [/cairn:\/\/p\/rune\/main(?:\/\S*)?/g, "this site's documenting thread"],
  [/cairn:\/\/p\//g, ''],
  [/\b(main|host)\/chat(?:\/raw)?|\b(main|host) chat\b/g, "$1$2's thread"],
  [/\?format=\w+/g, ''],
];

/** Positions inside a transcript and raw store numbers: traceability, not something a reader can follow. */
/** A number in a list of turns or lines, but not the hour of a time ('15:30') or a date ('20 Oct'). */
const LISTED = String.raw`(?:,\s*~?\d+(?:-\d+)?(?![\d:])(?! (?:Oct|PDT|UTC)))*`;

const NOISE: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(of|in) turn \d+/g, '$1 a message'],
  [/,?\s*\(?\s*rendered line \d+\s*\)?/gi, ''],
  [/,?\s*\(?\s*raw (?:seq(?:uence)?|sequences?) [\d,\s]+(?:createdAt \d+)?\)?/gi, ''],
  [/,?\s*\(?\s*(?:at )?(?:epoch|createdAt) \d{9,}(?:\s*=\s*)?\)?/gi, ''],
  [/,?\s*(?:same, )?seq(?:uence)?s? \d+(?:,\s*\d+)*(?: of run [0-9a-f]{6,})?/gi, ''],
  [/\s*\(run [0-9a-f]{6,}\)|\s+in run [0-9a-f]{6,}/g, ''],
  [/\b\d{10,}\b/g, ''],
  [new RegExp(String.raw`(?<=[\s(])(?:Turn|turns?) ~?\d+(?:\s*(?:-|to|–)\s*\d+)?${LISTED}(?:\s*·)?,?`, 'g'), ''],
  [/,\s*lines? \d+(?:\s*(?:-|to|–)\s*\d+)?(?: and \d+(?:-\d+)?)?/g, ''],
  [/(thread|messages|journal)\s+lines? \d+(?:\s*(?:-|to|–)\s*\d+)?(?: and \d+(?:-\d+)?)?/g, '$1'],
  [/\bthread line \d+/g, 'thread'],
];

export function plainWords(s: string): string {
  let out = s.replace(/\*\*/g, '').replace(/`/g, '');
  for (const [re, to] of PLACES) out = out.replace(re, to);
  for (const [re, to] of NOISE) out = out.replace(re, to);
  return out
    .replace(/\(\s*\)/g, '')
    .replace(/\(\s*,?\s*/g, '(')
    .replace(/(\w)\(/g, '$1 (')
    .replace(/,\s*;/g, ';')
    .replace(/\s+([,;.)])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

/**
 * A dig file's source table (a markdown table, a bullet list, or notes under it)
 * as one plain line per source: the quote, then who, where and when.
 */
export function plainSourceLines(table: string): string[] {
  const out: string[] = [];
  const lines = table.split('\n').map((l) => l.trim());
  const separator = (l: string | undefined) => !!l?.startsWith('|') && cells(l).every((x) => /^:?-+:?$/.test(x));
  for (const [i, l] of lines.entries()) {
    if (!l || /^#/.test(l) || /^-{3,}$/.test(l)) continue;
    if (l.startsWith('|')) {
      const c = cells(l);
      if (separator(l) || separator(lines[i + 1])) continue; // the separator row and the header above it
      const [what, ...rest] = c.map(plainWords);
      const where = rest.filter(Boolean).join(', ');
      out.push(where ? `${what}: ${where}` : what!);
    } else {
      out.push(plainWords(l.replace(/^[-*] /, '')));
    }
  }
  return out.filter(Boolean);
}

/** A one-paragraph receipt, broken at its semicolons, in plain words. */
export const plainReceiptLines = (receipt: string) => receipt.split(/;\s+/).map(plainWords).filter(Boolean);
