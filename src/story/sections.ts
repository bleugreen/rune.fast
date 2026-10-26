import { capitalize, countWord, fmtInt } from '../lib/numbers';
import type { HeadlineFacts, RecordFacts } from '../attempts/model';

export interface StorySection {
  id: string;
  title: string;
  dates: string;
  /** Placeholder prose until the narrative is written, from the story spine's notes and their sources. */
  notes: string[];
  /** Where the section's figure lives today, if it exists yet. */
  figure?: { to: string; label: string };
}

export function storySections(record: RecordFacts, facts: HeadlineFacts): StorySection[] {
  return [
    {
      // Sources: the commissioning issue; meta.tick_units in data/attempts-timeline.json.
      id: 'the-number',
      title: 'The number',
      dates: '20 Oct 2026',
      notes: [
        'The hiscore ranks accounts by the tick of their last level-up.',
        `Only logged-in ticks count, at ${record.tickMs} ms each.`,
        `The record was ${fmtInt(record.previous)}.`,
      ],
    },
    {
      // Source: rs-document work/tricks-inventory.md, sections 1, 2, 3 and 5.
      id: 'the-tricks',
      title: 'The tricks',
      dates: '20–22 Oct',
      notes: [
        'Fermenting wine never checks Cooking level, so Cooking went from 1 to 99 in 45 to 51 ticks.',
        'Charge has no cooldown, so Magic went from 80 to 99 in about 33.',
        'A knife click after each woodcutting roll saved about 2,739 ticks, and five dialogue clicks a tick saved 878.',
      ],
      figure: { to: '/tricks', label: 'The tricks' },
    },
    {
      // Source: rs-document pages/v3-data/summary.json (peak_conc, day_usd); operator messages in the timeline.
      id: 'the-swarm',
      title: 'The swarm at full tilt',
      dates: '21–22 Oct',
      notes: [
        'On 22 October the swarm ran up to 479 agent turns at once and spent $5,448 of model time at list price.',
        'When Claude’s limits ran out, agents moved to GPT.',
      ],
    },
    {
      // Source: data/attempts-timeline.json, A1 to A4 and R3.
      id: 'four-attempts',
      title: 'Four attempts in a day',
      dates: '23–24 Oct',
      notes: [
        'Attempt 1 failed 34 seconds in, 77 tiles from its Firemaking spot, then spent seven minutes in combat with a chicken.',
        'Attempt 2 stalled waiting for bones. Attempt 3 ended at 2,290 ticks, one inventory slot short.',
        'The rehearsal died twice in the Wilderness, and Attempt 4 died of poison at the Grand Tree.',
        'The operator wrote “attempt 4 is your last attempt”, then “ok fine one more attempt”.',
      ],
      figure: { to: '/attempts', label: 'The attempts timeline' },
    },
    {
      // Source: data/attempts-timeline.json, A5 to the S27 stop.
      id: 'twenty-eight-hours',
      title: 'Twenty-eight hours',
      dates: '25–26 Oct',
      notes: [
        `Attempt 5 stopped ${countWord(facts.lastStops)} times.`,
        'At Thieving it sat logged out for 9 h 08 min while helpers timed out and the coordinators went quiet.',
        '“Wall clock is free, ticks are not,” the operator wrote.',
      ],
      figure: { to: '/attempts', label: 'The attempts timeline' },
    },
    {
      // Source: data/attempts-timeline.json, A5 from 03:36 on 26 October.
      id: 'the-death',
      title: `The death and the ${fmtInt(record.margin)} ticks`,
      dates: '26 Oct',
      notes: [
        'A one-off login walked the account back to the spiders, and the game refused its logout mid-combat.',
        'The operator overrode a takeover order with “Log out!!!”, and the account died at 03:40:37.',
        `The projection said 378.9 ticks over the record. The recovery logged in at 10:27 and finished at ${fmtInt(record.final)}.`,
      ],
      figure: { to: '/attempts', label: 'The attempts timeline' },
    },
  ].map(({ notes, ...s }) => ({ ...s, notes: notes.map(capitalize) }));
}
