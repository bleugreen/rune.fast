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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const short = (name: string) => name.slice(0, 3);
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Every date and time the site shows is assembled here from the Pacific wall clock's numbers and
 * the names above, never from a locale's pattern. ICU versions disagree on a pattern's punctuation
 * and spacing (en-GB's 'Fri 23 Oct' is 'Fri, 23 Oct' in Bun's ICU 75 on Linux, and the space before
 * AM is U+202F in some), and a page is rendered by the build and again by the reader's browser:
 * the two must agree to the byte, or hydration throws the build's render away.
 */
const pacNumeric = new Intl.DateTimeFormat('en-US', {
  timeZone: PACIFIC,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

interface Wall {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  /** 0 is Sunday. */
  weekday: number;
  /** 0-23 */
  hour: number;
  minute: number;
  second: number;
}

/** The Pacific wall clock at t. */
function pacific(t: number): Wall {
  const n: Record<string, number> = {};
  for (const { type, value } of pacNumeric.formatToParts(t)) if (type !== 'literal') n[type] = Number(value);
  const { year, month, day, hour, minute, second } = n as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
  return {
    year,
    month,
    day,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    hour,
    minute,
    second,
  };
}

/** The 12-hour clock as the site writes it: 'h:mm AM' or 'h:mm:ss AM'. */
function clock(t: number, withSeconds: boolean): string {
  const w = pacific(t);
  const seconds = withSeconds ? `:${pad2(w.second)}` : '';
  return `${w.hour % 12 || 12}:${pad2(w.minute)}${seconds} ${w.hour < 12 ? 'AM' : 'PM'}`;
}

const month = (w: Wall) => MONTHS[w.month - 1]!;
const weekday = (w: Wall) => WEEKDAYS[w.weekday]!;

/** '22 October', Pacific */
export const fmtPacificDayMonth = (t: number) => {
  const w = pacific(t);
  return `${w.day} ${month(w)}`;
};
/** '22 Oct', Pacific */
export const fmtPacificDayMon = (t: number) => {
  const w = pacific(t);
  return `${w.day} ${short(month(w))}`;
};
/** The Pacific calendar day of t, 'YYYY-MM-DD'. */
export const pacificDayKey = (t: number) => {
  const w = pacific(t);
  return `${w.year}-${pad2(w.month)}-${pad2(w.day)}`;
};
/** 'Thu 22', Pacific */
export const fmtPacificWeekdayDay = (t: number) => {
  const w = pacific(t);
  return `${short(weekday(w))} ${w.day}`;
};
/** 'Thursday 22 October', Pacific */
export const fmtPacificDayLong = (t: number) => {
  const w = pacific(t);
  return `${weekday(w)} ${w.day} ${month(w)}`;
};
/** 'Thursday', Pacific */
export const fmtPacificWeekday = (t: number) => weekday(pacific(t));
/** 'Thu 22 Oct', Pacific */
export const fmtPacificDayShort = (t: number) => {
  const w = pacific(t);
  return `${short(weekday(w))} ${w.day} ${short(month(w))}`;
};
/** '22 October 2026', Pacific */
export const fmtPacificDate = (t: number) => {
  const w = pacific(t);
  return `${w.day} ${month(w)} ${w.year}`;
};
/** '22 Oct 2026', Pacific */
export const fmtPacificDayMonYear = (t: number) => {
  const w = pacific(t);
  return `${w.day} ${short(month(w))} ${w.year}`;
};
/** The Pacific hour of t, 0-23. */
export const pacificHour = (t: number) => pacific(t).hour;
/** '2:37 PM', '12:05 AM', Pacific. The site never names the zone. */
export const fmtPacificHm = (t: number) => clock(t, false);
/** '4:14:43 AM', Pacific, with no zone. */
export const fmtPacificHms = (t: number) => clock(t, true);

/** A span of the clock, the period written once where both ends share it: '3:27:15–3:27:27 AM', '11:58 PM–12:03 AM'. */
export function fmtPacificClockRange(a: number, b: number, withSeconds = false): string {
  const [from, to] = [a, b].map(withSeconds ? fmtPacificHms : fmtPacificHm) as [string, string];
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)}–${to}` : `${from}–${to}`;
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar day 'YYYY-MM-DD' (such as a pacificDayKey) as '26 October 2026'. No instant is involved, so no zone can move it. */
export function fmtCalendarDate(key: string): string {
  const m = DAY_KEY.exec(key);
  const month = m && MONTHS[Number(m[2]) - 1];
  if (!m || !month) throw new Error(`Not a calendar day: ${key}`);
  return `${Number(m[3])} ${month} ${m[1]}`;
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
  return parts.join(' ');
}

/** The Pacific midnights in [a, b]. Pacific offsets are whole hours, so midnight falls on a UTC hour. */
export function pacificMidnights(a: number, b: number): number[] {
  const out: number[] = [];
  for (let t = Math.ceil(a / HOUR) * HOUR; t <= b; t += HOUR) if (pacificHour(t) === 0) out.push(t);
  return out;
}
