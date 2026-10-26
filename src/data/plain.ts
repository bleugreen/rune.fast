import plain from '../../data/attempts-plain.json';

/**
 * Plain-language lines for timeline events, keyed `${attemptId}/${utc}`, written
 * from each event's own title, cause and detail for a reader who does not know
 * the swarm's step codes. Operator messages speak for themselves and mostly have none.
 */
const PLAIN = plain as Record<string, string>;

export const plainKey = (attemptId: string, utc: string) => `${attemptId}/${utc}`;
export const plainFor = (attemptId: string, utc: string): string | undefined => PLAIN[plainKey(attemptId, utc)];
export const plainKeys = () => Object.keys(PLAIN);
