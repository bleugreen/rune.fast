/**
 * Operator messages set as pulled quotes under the attempts chart, keyed by
 * attempt and stored UTC. The text comes from the event's `quote`.
 */
export interface PulledQuote {
  attempt: string;
  utc: string;
}

export const PULLED: readonly PulledQuote[] = [
  { attempt: 'A4', utc: '2026-10-24T16:28:33Z' },
  { attempt: 'A5', utc: '2026-10-25T21:53:35Z' },
  { attempt: 'A5', utc: '2026-10-26T03:39:53Z' },
  { attempt: 'A5', utc: '2026-10-26T03:40:44Z' },
  { attempt: 'A5', utc: '2026-10-26T04:09:19Z' },
  { attempt: 'A5', utc: '2026-10-26T11:16:47Z' },
];
