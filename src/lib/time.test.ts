import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { fmtCalendarDate, pacificDayKey } from './time';

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
