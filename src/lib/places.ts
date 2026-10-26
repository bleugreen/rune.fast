/**
 * The swarm's addresses in plain words: the one table every page's sources go
 * through. The data files keep their cairn:// addresses as the project's
 * traceability; a reader outside the swarm cannot open them, so the site prints
 * who and where instead. Longest forms first: each shape is tried before its prefixes.
 */
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
  [/cairn:\/\/p\/rs\/(main|host)\b/g, "$1's thread"],
  [/cairn:\/\/p\/rs\b(?!\/)/g, 'the rs project'],
  [/cairn:\/\/posts\/(\d+)/g, 'swarm post $1'],
  [/cairn:\/\/p\/rune\/main(?:\/\S*)?/g, "this site's documenting thread"],
  [/cairn:\/\/p\//g, ''],
  [/\b(main|host)\/chat(?:\/raw)?|\b(main|host) chat\b/g, "$1$2's thread"],
  [/\?format=\w+/g, ''],
];

export const plainPlaces = (s: string) => PLACES.reduce((out, [re, to]) => out.replace(re, to), s);
