import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import {
  fmtCalendarDate,
  fmtPacificClockRange,
  fmtPacificHm,
  fmtPacificHms,
  pacificDayKey,
  pacificHour,
  pacificMidnights,
  parseUtc,
} from './time';

describe('the clock', () => {
  test('is Pacific on the 12-hour clock, unpadded, with a plain space before an uppercase period', () => {
    expect(fmtPacificHm(parseUtc('2026-10-20T21:37:42Z'))).toBe('2:37 PM');
    expect(fmtPacificHm(parseUtc('2026-10-24T06:07Z'))).toBe('11:07 PM');
    expect(fmtPacificHms(parseUtc('2026-10-26T11:14:43.680Z'))).toBe('4:14:43 AM');
  });

  test('writes midnight and noon as 12', () => {
    expect(fmtPacificHm(parseUtc('2026-10-25T07:05Z'))).toBe('12:05 AM');
    expect(fmtPacificHm(parseUtc('2026-10-25T19:30Z'))).toBe('12:30 PM');
  });

  test('follows the zone across the change from PDT to PST', () => {
    // 1 November 2026: 01:30 PDT is 08:30Z; an hour later the clock reads 01:30 again, PST.
    expect(fmtPacificHm(parseUtc('2026-11-01T08:30Z'))).toBe('1:30 AM');
    expect(fmtPacificHm(parseUtc('2026-11-01T09:30Z'))).toBe('1:30 AM');
  });

  test('keeps the hour 0-23 for axis arithmetic', () => {
    expect(pacificHour(parseUtc('2026-10-25T07:00Z'))).toBe(0);
    expect(pacificHour(parseUtc('2026-10-25T19:00Z'))).toBe(12);
    expect(pacificHour(parseUtc('2026-10-26T06:00Z'))).toBe(23);
    expect(pacificMidnights(parseUtc('2026-10-24T00:00Z'), parseUtc('2026-10-26T00:00Z'))).toEqual([
      parseUtc('2026-10-24T07:00Z'),
      parseUtc('2026-10-25T07:00Z'),
    ]);
  });

  test('writes a span’s period once where both ends share it', () => {
    expect(fmtPacificClockRange(parseUtc('2026-10-26T10:27:15Z'), parseUtc('2026-10-26T10:27:27Z'), true)).toBe('3:27:15–3:27:27 AM');
    expect(fmtPacificClockRange(parseUtc('2026-10-25T06:58Z'), parseUtc('2026-10-25T07:03Z'))).toBe('11:58 PM–12:03 AM');
  });
});

describe('the build date', () => {
  afterEach(() => setSystemTime());

  test('is the Pacific calendar day, not the UTC one', () => {
    // 17:05 PDT on Monday 26 October is already the 27th in UTC.
    expect(pacificDayKey(Date.parse('2026-10-27T00:05:00Z'))).toBe('2026-10-26');
    // 23:59 PDT on Sunday 25 October.
    expect(pacificDayKey(Date.parse('2026-10-26T06:59:00Z'))).toBe('2026-10-25');
  });

  test('vite.config.ts stamps the Pacific day for an evening build', async () => {
    setSystemTime(new Date('2026-10-27T00:05:00Z'));
    const { default: config } = await import('../../vite.config');
    expect(config.define?.__BUILD_DATE__).toBe(JSON.stringify('2026-10-26'));
  });

  test('renders as the calendar day it names, whatever the zone', () => {
    expect(fmtCalendarDate('2026-10-26')).toBe('26 October 2026');
    expect(fmtCalendarDate('2026-01-01')).toBe('1 January 2026');
    expect(fmtCalendarDate('2026-12-31')).toBe('31 December 2026');
    expect(() => fmtCalendarDate('2026-13-01')).toThrow();
    expect(() => fmtCalendarDate('2026-10-26T00:00Z')).toThrow();
  });
});
