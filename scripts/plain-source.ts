import type { ArchivalSource } from '../src/data/types';
import { plainPlaces } from '../src/lib/places';
import { fmtPacificDayMon, fmtPacificHm, pacificZone, parseUtc } from '../src/lib/time';

/**
 * Source lines for the tricks cards and the attempts timeline, in plain words:
 * the swarm's addresses through the shared table in src/lib/places.ts, and the
 * forms only these files use (the rs-sdk fork's paths, this site's own timeline,
 * the database export) named for an outside reader, with times in Pacific.
 */
const FORMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^rs-sdk /, 'rs-sdk fork, '],
  [/^data\/attempts-timeline\.json\b/, 'the attempts timeline'],
  [/^DuckDB rs-\d{8}\.duckdb$/, "the rs project's database export"],
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
  return text.replace(UTC_MOMENT, (_, d: string | undefined, h: string, m: string) => {
    day = d ?? day;
    if (!day) throw new Error(`A UTC time with no day to anchor it: ${text}`);
    return pacific(parseUtc(`${MONTH}-${day.padStart(2, '0')}T${h}:${m}Z`));
  });
}

/** One source line in plain words. Throws if an address or a UTC time survives. */
export function plainSource(text: string): string {
  const out = toPacific(FORMS.reduce((s, [re, sub]) => s.replace(re, sub), plainPlaces(text)));
  if (/cairn:/.test(out) || /\d{2}:\d{2}Z\b/.test(out)) throw new Error(`No plain-words form for the source: ${text}`);
  return out;
}

/** A timeline source: the place, the comment if it is one, and the moment ('issue rs/843, comment 54, 26 Oct 04:16 PDT'). */
export function plainArchivalSource({ uri, ts, comment }: ArchivalSource): string {
  const when = !ts ? null : ts.includes('T') ? pacific(parseUtc(ts)) : fmtPacificDayMon(parseUtc(`${ts}T19:00Z`));
  return [plainSource(uri), comment !== undefined ? `comment ${comment}` : null, when].filter(Boolean).join(', ');
}
