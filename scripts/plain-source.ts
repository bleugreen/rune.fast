import type { ArchivalSource } from '../src/data/types';
import { plainPlaces } from '../src/lib/places';
import { fmtPacificClockRange, fmtPacificDayMon, fmtPacificHm, fmtPacificHms, parseUtc } from '../src/lib/time';

/**
 * Source lines for the tricks cards and the attempts timeline, in plain words:
 * the swarm's addresses through the shared table in src/lib/places.ts, and the
 * forms only these files use (the rs-sdk fork's paths, this site's own timeline,
 * the database export) named for an outside reader, with times on the Pacific
 * 12-hour clock and no zone, which each page names once.
 */
const FORMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^rs-sdk /, 'rs-sdk fork, '],
  [/^data\/attempts-timeline\.json\b/, 'the attempts timeline'],
  [/^DuckDB rs-\d{8}\.duckdb$/, "the rs project's database export"],
];

/**
 * Free-text sources date a moment by day and month with a UTC clock time
 * ('25 Oct 09:33Z', a bare '06:28Z' after a dated one, or a span to the second
 * sharing one Z, '26 Oct 10:28:39-10:28:53Z'), or now and then on the Pacific
 * clock the swarm printed ('26 Oct 14:08 PDT'); every such moment falls in October 2026.
 */
const UTC_MOMENT = /(?:(\d{1,2}) Oct )?(\d{2}:\d{2}(?::\d{2})?)(?:-(\d{2}:\d{2}(?::\d{2})?))?Z\b/g;
const PACIFIC_MOMENT = /\b(\d{1,2}) Oct (\d{2}):(\d{2}) P([DS])T\b/g;
const MONTH = '2026-10';

const pacificClock = (t: number, seconds: boolean) => (seconds ? fmtPacificHms(t) : fmtPacificHm(t));
const pacific = (t: number) => `${fmtPacificDayMon(t)} ${fmtPacificHm(t)}`;

function toPacific(text: string): string {
  let day: string | undefined;
  return text
    .replace(UTC_MOMENT, (_, d: string | undefined, from: string, to: string | undefined) => {
      day = d ?? day;
      if (!day) throw new Error(`A UTC time with no day to anchor it: ${text}`);
      const at = (clock: string) => parseUtc(`${MONTH}-${day!.padStart(2, '0')}T${clock}Z`);
      const a = at(from);
      const seconds = from.length > 5;
      return `${fmtPacificDayMon(a)} ${to ? fmtPacificClockRange(a, at(to), seconds) : pacificClock(a, seconds)}`;
    })
    .replace(PACIFIC_MOMENT, (_, d: string, h: string, m: string, dst: string) => {
      const offset = dst === 'D' ? 7 : 8;
      return pacific(Date.UTC(2026, 9, Number(d), Number(h) + offset, Number(m)));
    });
}

/** One source line in plain words. Throws if an address, a UTC time or a zone survives. */
export function plainSource(text: string): string {
  const out = toPacific(FORMS.reduce((s, [re, sub]) => s.replace(re, sub), plainPlaces(text)));
  if (/cairn:/.test(out) || /\d{2}:\d{2}Z\b/.test(out) || /\bP[DS]T\b/.test(out)) {
    throw new Error(`No plain-words form for the source: ${text}`);
  }
  return out;
}

/** A timeline source: the place, the comment if it is one, and the moment ('issue rs/843, comment 54, 26 Oct 4:16 AM'). */
export function plainArchivalSource({ uri, ts, comment }: ArchivalSource): string {
  const when = !ts ? null : ts.includes('T') ? pacific(parseUtc(ts)) : fmtPacificDayMon(parseUtc(`${ts}T19:00Z`));
  return [plainSource(uri), comment !== undefined ? `comment ${comment}` : null, when].filter(Boolean).join(', ');
}
