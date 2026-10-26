import { capitalize, countWord, fmtInt } from '../lib/numbers';
import type { HeadlineFacts, RecordFacts } from '../attempts/model';

export interface StorySection {
  id: string;
  title: string;
  dates: string;
  /**
   * Placeholder prose, verbatim from the section notes: section 1 from the issue
   * that commissioned the site, the rest from the story spine
   * (rs-document work/spine-v1.md) with its source citations left off.
   */
  notes: string[];
  /** Where the section's figure lives today, if it exists yet. */
  figure?: { to: string; label: string };
}

export function storySections(record: RecordFacts, facts: HeadlineFacts): StorySection[] {
  return [
    {
      id: 'the-number',
      title: 'The number',
      dates: '20 Oct 2026',
      notes: [
        'The hiscore ranks accounts by the in-world tick of their last level-up.',
        'Logged-out time is free.',
        `The record to beat is ${fmtInt(record.previous)} ticks.`,
      ],
      figure: { to: '/attempts#ticks', label: 'The ticks ladder' },
    },
    {
      id: 'the-tricks',
      title: 'The tricks',
      dates: '20–22 Oct',
      notes: ['Knife loop ~2,739 expected ticks.', 'Wine 45–51 ticks for Cooking 1–99.', 'Charge 33 ticks; bursts 878.'],
    },
    {
      id: 'the-swarm',
      title: 'The swarm at full tilt',
      dates: '21–22 Oct',
      notes: ['22 Oct: 479 concurrent turns, 309 spawns, 8,712 messages.', 'Claude limits → GPT swap.', 'Whitespace-free coordinator.'],
    },
    {
      id: 'four-attempts',
      title: 'Four attempts in a day',
      dates: '23–24 Oct',
      notes: [
        'A1 77 tiles off + chicken; A2 noted rings; A3 knife gate → plain, 2,290.',
        'Rehearsal two deaths; A4 poison at the Grand Tree door.',
        'Operator “attempt 4 is your last attempt” → “ok fine one more attempt”.',
      ],
      figure: { to: '/attempts', label: 'The attempts timeline' },
    },
    {
      id: 'twenty-eight-hours',
      title: 'Twenty-eight hours',
      dates: '25–26 Oct',
      notes: [
        `${capitalize(countWord(facts.lastStops))} stops.`,
        'S18 nine-hour hold: diagonal door, usage limits, 6h46m silence, 600-minute cue expiry, demo restart, three one-offs for two pockets, 51 ticks.',
        '“Wall clock is free, ticks are not.”',
      ],
      figure: { to: '/attempts', label: 'The attempts timeline' },
    },
    {
      id: 'the-death',
      title: 'The death and the 129 ticks',
      dates: '26 Oct',
      notes: [
        'Return-only logout refused, body abandoned; takeover ruling 03:39:17Z overridden by “Log out!!!” 03:39:53Z; death 03:40:37Z.',
        'Projection 36,294.9 vs 35,916; “we’re not done until #1”.',
        `Recovery 10:27:08Z; Agility 99 11:07:53Z; official ${fmtInt(record.final)}.`,
      ],
      figure: { to: '/attempts', label: 'The attempts timeline' },
    },
  ];
}
