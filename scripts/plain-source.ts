import type { ArchivalSource } from '../src/data/types';
import { fmtPacificDayMon, fmtPacificHm, pacificZone, parseUtc } from '../src/lib/time';

/**
 * Sources stay in data/ as the swarm's own addresses, for traceability. A reader
 * outside the swarm cannot open them, so the public projections print each one
 * as plain-words provenance instead: who, where, and when in Pacific time.
 */

/** Addresses in the order they must be tried: longer shapes before their prefixes. */
const PLACES: ReadonlyArray<readonly [RegExp, string]> = [
  [/cairn:\/\/p\/rs\/(\d+) and cairn:\/\/p\/rs\/(\d+)/g, 'issues rs/$1 and rs/$2'],
  [/cairn:\/\/p\/rs\/(\d+)\/\d+\/([a-z]+)\/(messages|chat)/g, 'issue rs/$1, the $2’s $3'],
  [/cairn:\/\/p\/rs\/(\d+)/g, 'issue rs/$1'],
  [/cairn:\/\/p\/rs\/(main|host)\/(messages|chat)/g, 'the $1 thread’s $2'],
  [/cairn:\/\/p\/rs\/(main|host)\b/g, 'the $1 thread'],
  [/cairn:\/\/posts\/(\d+)/g, 'swarm post $1'],
  [/cairn:\/\/p\/rs\b/g, 'the rs project'],
  [/^rs-sdk /, 'rs-sdk fork, '],
  [/^data\/attempts-timeline\.json\b/, 'the attempts timeline'],
  [/^DuckDB rs-\d{8}\.duckdb$/, 'the rs project’s database export'],
];

/**
 * Free-text sources date a moment by day and month with a UTC clock time
 * ('25 Oct 09:33Z', or a bare '06:28Z' after a dated one); every such moment
 * falls in October 2026.
 */
const UTC_MOMENT = /(?:(\d{1,2}) Oct )?(\d{2}):(\d{2})Z\b/g;
const MONTH = '2026-10';

const pacific = (t: number) => `${fmtPacificDayMon(t)} ${fmtPacificHm(t)} ${pacificZone(t)}`;

function toPacific(text: string): string {
  let day: string | undefined;
  return text.replace(UTC_MOMENT, (whole, d: string | undefined, h: string, m: string) => {
    day = d ?? day;
    if (!day) throw new Error(`A UTC time with no day to anchor it: ${text}`);
    return pacific(parseUtc(`${MONTH}-${day.padStart(2, '0')}T${h}:${m}Z`));
  });
}

/** One source line in plain words. Throws if an address or a UTC time survives. */
export function plainSource(text: string): string {
  const out = toPacific(PLACES.reduce((s, [re, sub]) => s.replace(re, sub), text));
  if (/cairn:/.test(out) || /\d{2}:\d{2}Z\b/.test(out)) throw new Error(`No plain-words form for the source: ${text}`);
  return out;
}

/** A timeline source: the place, the comment if it is one, and the moment ('issue rs/843, comment 54, 26 Oct 04:16 PDT'). */
export function plainArchivalSource({ uri, ts, comment }: ArchivalSource): string {
  const when = !ts ? null : ts.includes('T') ? pacific(parseUtc(ts)) : fmtPacificDayMon(parseUtc(`${ts}T19:00Z`));
  return [plainSource(uri), comment !== undefined ? `comment ${comment}` : null, when].filter(Boolean).join(', ');
}
