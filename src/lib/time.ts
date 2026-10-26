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

const PACIFIC = 'America/Los_Angeles';

const utcDayShort = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const utcDayLong = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const utcDayMonthYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const utcHm = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const pacHm = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const pacZone = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC, timeZoneName: 'short' });

const utcWeekdayDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });
const utcDayMonth = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long' });
const pacDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC, year: 'numeric', month: '2-digit', day: '2-digit' });
const pacWeekdayDay = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, weekday: 'short', day: 'numeric' });
const pacDayLong = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, weekday: 'long', day: 'numeric', month: 'long' });
const pacWeekday = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, weekday: 'long' });

export const fmtUtcDayShort = (t: number) => utcDayShort.format(t);
/** 'Thu 22' */
export const fmtUtcWeekdayDay = (t: number) => utcWeekdayDay.format(t);
/** '22 October' */
export const fmtUtcDayMonth = (t: number) => utcDayMonth.format(t);
/** The Pacific calendar day of t, 'YYYY-MM-DD'. */
export const pacificDayKey = (t: number) => pacDayKey.format(t);
/** 'Thu 22', Pacific */
export const fmtPacificWeekdayDay = (t: number) => pacWeekdayDay.format(t);
/** 'Thursday 22 October', Pacific */
export const fmtPacificDayLong = (t: number) => pacDayLong.format(t);
/** 'Thursday', Pacific */
export const fmtPacificWeekday = (t: number) => pacWeekday.format(t);
export const fmtUtcDayLong = (t: number) => utcDayLong.format(t);
export const fmtUtcDate = (t: number) => utcDayMonthYear.format(t);
export const fmtUtcHm = (t: number) => utcHm.format(t);
export const fmtPacificHm = (t: number) => pacHm.format(t);

/** Pacific zone abbreviation in force at t (PDT or PST). */
export function pacificZone(t: number): string {
  return pacZone.formatToParts(t).find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** '26 October 2026' within one day, '23–26 October 2026' within one month, else both dates in full. */
export function fmtUtcDateRange(a: number, b: number): string {
  const da = new Date(a);
  const db = new Date(b);
  if (da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10)) return fmtUtcDate(a);
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

/** The Pacific midnights in [a, b]. Pacific offsets are whole hours, so midnight falls on a UTC hour. */
export function pacificMidnights(a: number, b: number): number[] {
  const out: number[] = [];
  for (let t = Math.ceil(a / HOUR) * HOUR; t <= b; t += HOUR) if (pacHm.format(t) === '00:00') out.push(t);
  return out;
}
