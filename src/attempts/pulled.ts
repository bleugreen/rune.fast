/**
 * Operator messages set as pulled quotes on the attempts chart, keyed by attempt
 * and stored UTC (the text comes from the event's `quote`). `lift` is how far
 * above the row line the quote's bottom sits and `align` which side of its
 * leader the text runs; both are layout, tuned so leaders never cross a quote.
 */
export interface PulledQuote {
  attempt: string;
  utc: string;
  align: 'start' | 'end';
  lift: number;
  maxWidth?: number;
}

export const PULLED: readonly PulledQuote[] = [
  { attempt: 'A4', utc: '2026-10-24T16:28:33Z', align: 'start', lift: 26 },
  { attempt: 'A5', utc: '2026-10-25T21:53:35Z', align: 'end', lift: 26, maxWidth: 190 },
  { attempt: 'A5', utc: '2026-10-26T03:39:53Z', align: 'end', lift: 26 },
  { attempt: 'A5', utc: '2026-10-26T03:40:44Z', align: 'end', lift: 112 },
  { attempt: 'A5', utc: '2026-10-26T04:09:19Z', align: 'start', lift: 152 },
  { attempt: 'A5', utc: '2026-10-26T11:16:47Z', align: 'start', lift: 26, maxWidth: 104 },
];
