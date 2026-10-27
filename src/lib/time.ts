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

const pacHour = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, hour: '2-digit', hourCycle: 'h23' });
const pacHm = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC, hour: 'numeric', minute: '2-digit', hour12: true });
const pacHms = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
const pacZone = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC, timeZoneName: 'short' });

const pacDayMonth = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, day: 'numeric', month: 'long' });
const pacDayMon = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, day: 'numeric', month: 'short' });
const pacDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC, year: 'numeric', month: '2-digit', day: '2-digit' });
const pacWeekdayDay = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, weekday: 'short', day: 'numeric' });
const pacDayLong = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, weekday: 'long', day: 'numeric', month: 'long' });
const pacWeekday = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, weekday: 'long' });
const pacDayShort = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, weekday: 'short', day: 'numeric', month: 'short' });
const pacDayMonthYear = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, day: 'numeric', month: 'long', year: 'numeric' });
const pacDayMonYear = new Intl.DateTimeFormat('en-GB', { timeZone: PACIFIC, day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The 12-hour clock as the site writes it, 'h:mm AM' or 'h:mm:ss AM', assembled from the
 * parts: ICU versions differ on the space before the period (U+202F or a plain space)
 * and on the hour's padding, and the page must not.
 */
function clock(f: Intl.DateTimeFormat, t: number): string {
  const p: Record<string, string> = {};
  for (const { type, value } of f.formatToParts(t)) p[type] = value;
  const seconds = p.second ? `:${p.second}` : '';
  return `${Number(p.hour)}:${p.minute}${seconds} ${p.dayPeriod!.toUpperCase()}`;
}

/** '22 October', Pacific */
export const fmtPacificDayMonth = (t: number) => pacDayMonth.format(t);
/** '22 Oct', Pacific */
export const fmtPacificDayMon = (t: number) => pacDayMon.format(t);
/** The Pacific calendar day of t, 'YYYY-MM-DD'. */
export const pacificDayKey = (t: number) => pacDayKey.format(t);
/** 'Thu 22', Pacific */
export const fmtPacificWeekdayDay = (t: number) => pacWeekdayDay.format(t);
/** 'Thursday 22 October', Pacific */
export const fmtPacificDayLong = (t: number) => pacDayLong.format(t);
/** 'Thursday', Pacific */
export const fmtPacificWeekday = (t: number) => pacWeekday.format(t);
/** 'Thu 22 Oct', Pacific */
export const fmtPacificDayShort = (t: number) => pacDayShort.format(t);
/** '22 October 2026', Pacific */
export const fmtPacificDate = (t: number) => pacDayMonthYear.format(t);
/** '22 Oct 2026', Pacific */
export const fmtPacificDayMonYear = (t: number) => pacDayMonYear.format(t);
/** The Pacific hour of t, 0-23. */
export const pacificHour = (t: number) => Number(pacHour.formatToParts(t).find((p) => p.type === 'hour')!.value);
/** '2:37 PM', '12:05 AM', Pacific, with no zone: the page names it once. */
export const fmtPacificHm = (t: number) => clock(pacHm, t);
/** '4:14:43 AM', Pacific, with no zone. */
export const fmtPacificHms = (t: number) => clock(pacHms, t);

/** A span of the clock, the period written once where both ends share it: '3:27:15–3:27:27 AM', '11:58 PM–12:03 AM'. */
export function fmtPacificClockRange(a: number, b: number, withSeconds = false): string {
  const [from, to] = [a, b].map(withSeconds ? fmtPacificHms : fmtPacificHm) as [string, string];
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)}–${to}` : `${from}–${to}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar day 'YYYY-MM-DD' (such as a pacificDayKey) as '26 October 2026'. No instant is involved, so no zone can move it. */
export function fmtCalendarDate(key: string): string {
  const m = DAY_KEY.exec(key);
  const month = m && MONTHS[Number(m[2]) - 1];
  if (!m || !month) throw new Error(`Not a calendar day: ${key}`);
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** Pacific zone abbreviation in force at t (PDT or PST). */
export function pacificZone(t: number): string {
  return pacZone.formatToParts(t).find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** The Pacific dates a span covers: '26 October 2026', '23–26 October 2026', or both dates in full across months. */
export function fmtPacificDateRange(a: number, b: number): string {
  const [ka, kb] = [pacificDayKey(a), pacificDayKey(b)];
  if (ka === kb) return fmtPacificDate(a);
  if (ka.slice(0, 7) === kb.slice(0, 7)) return `${Number(ka.slice(8))}–${fmtPacificDate(b)}`;
  return `${fmtPacificDate(a)} – ${fmtPacificDate(b)}`;
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
  for (let t = Math.ceil(a / HOUR) * HOUR; t <= b; t += HOUR) if (pacificHour(t) === 0) out.push(t);
  return out;
}
