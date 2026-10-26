export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

/** ISO-8601 UTC as the timeline stores it: minutes, optional seconds, optional 1-3 fraction digits. */
const ISO_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?Z$/;

export function parseUtc(s: string): number {
  const m = ISO_UTC.exec(s);
  if (!m) throw new Error(`Not a UTC timestamp: ${s}`);
  const [, y, mo, d, h, mi, sec, frac] = m;
  return Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(sec ?? 0),
    frac ? Number(frac.padEnd(3, '0')) : 0,
  );
}

/** The clock part of a stored timestamp, at the precision the source recorded. */
export function storedClock(s: string): string {
  return s.slice(s.indexOf('T') + 1, -1);
}

const PACIFIC = 'America/Los_Angeles';

const utcDayShort = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const utcDayLong = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const utcDayMonth = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const utcDayMonthYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const utcHm = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const utcHms = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const pacHm = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const pacDayHms = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const pacZone = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC, timeZoneName: 'short' });

export const fmtUtcDayShort = (t: number) => utcDayShort.format(t);
export const fmtUtcDayLong = (t: number) => utcDayLong.format(t);
export const fmtUtcDayMonth = (t: number) => utcDayMonth.format(t);
export const fmtUtcDate = (t: number) => utcDayMonthYear.format(t);
export const fmtUtcHm = (t: number) => utcHm.format(t);
export const fmtUtcHms = (t: number) => utcHms.format(t);
export const fmtPacificHm = (t: number) => pacHm.format(t);

/** Pacific zone abbreviation in force at t (PDT or PST). */
export function pacificZone(t: number): string {
  return pacZone.formatToParts(t).find((p) => p.type === 'timeZoneName')?.value ?? '';
}

export function fmtPacific(t: number): string {
  return `${pacDayHms.format(t).replace(',', '')} ${pacificZone(t)}`;
}

/** '23–26 October 2026' for a span within one month, else both dates in full. */
export function fmtUtcDateRange(a: number, b: number): string {
  const da = new Date(a);
  const db = new Date(b);
  if (da.getUTCMonth() === db.getUTCMonth() && da.getUTCFullYear() === db.getUTCFullYear()) {
    return `${da.getUTCDate()}–${fmtUtcDate(b)}`;
  }
  return `${fmtUtcDate(a)} – ${fmtUtcDate(b)}`;
}

/** '9 h 08 min', '14 min', or with seconds '3 h 58 min 34 s'. Truncates, never rounds up. */
export function fmtDuration(ms: number, withSeconds = false): string {
  const total = Math.floor(ms / SECOND);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  parts.push(`${h ? String(m).padStart(2, '0') : m} min`);
  if (withSeconds) parts.push(`${s} s`);
  return parts.join(' ');
}
