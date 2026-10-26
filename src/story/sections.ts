import { capitalize, countWord, fmtInt } from '../lib/numbers';
import type { HeadlineFacts, RecordFacts } from '../attempts/model';

export interface StorySection {
  id: string;
  title: string;
  dates: string;
  /**
   * Placeholder prose until the narrative is written: the story spine's notes for
   * the section (rs-document work/spine-v1.md) set as sentences, using only facts
   * the spine's own sources carry. Sources per section are listed beside it.
   */
  notes: string[];
  /** Where the section's figure lives today, if it exists yet. */
  figure?: { to: string; label: string };
}

export function storySections(record: RecordFacts, facts: HeadlineFacts): StorySection[] {
  return [
    {
      // Sources: the issue that commissioned the site; meta.tick_units in data/attempts-timeline.json.
      id: 'the-number',
      title: 'The number',
      dates: '20 Oct 2026',
      notes: [
        'The demo server’s hiscore table ranks accounts by the in-world tick of their last level-up, and it counts only the ticks an account spends logged in, so time logged out is free.',
        `A tick is one step of the game clock, and the board normalizes it to ${record.tickMs} ms.`,
        `The record to beat was ${fmtInt(record.previous)} ticks.`,
      ],
      figure: { to: '/attempts#ticks', label: 'Ticks per attempt' },
    },
    {
      // Source: rs-document work/tricks-inventory.md, sections 1, 2, 3 and 5.
      id: 'the-tricks',
      title: 'The tricks',
      dates: '20–22 Oct',
      notes: [
        'The route leaned on quirks of the 2004 game engine.',
        'Fermenting wine checks no Cooking level, so a bank of unfermented wine raised Cooking from 1 to 99 in 45 to 51 active ticks, and the Charge spell has no cooldown, so five casts in one tick took Magic from 80 to 99 in about 33.',
        'Clicking a knife on logs in the tick after each woodcutting roll brought the next roll a tick sooner, worth about 2,739 expected ticks over the run, and blind dialogue clicks, five a tick, saved about 878 more across the quests.',
      ],
    },
    {
      // Source: rs-document pages/v3-data/summary.json (peak_conc, day_usd); operator messages in the timeline.
      id: 'the-swarm',
      title: 'The swarm at full tilt',
      dates: '21–22 Oct',
      notes: [
        'On 22 October the swarm ran as many as 479 agent turns at the same moment, and the day’s model time came to $5,448 at API list prices.',
        'When Claude’s usage limits ran out, agents were moved to GPT models.',
      ],
    },
    {
      // Source: data/attempts-timeline.json, attempts A1 to A4 and R3.
      id: 'four-attempts',
      title: 'Four attempts in a day',
      dates: '23–24 Oct',
      notes: [
        'Attempt 1 failed 34 seconds after login, 77 tiles from where its Firemaking step expected it, and stayed in the world another seven minutes while a chicken kept it in combat.',
        'Attempt 2 stalled waiting for bones from helper accounts, and Attempt 3 ended its scored run at 2,290 ticks, one inventory slot short at the willow trees.',
        'The same account then ran a live rehearsal and died twice in the Wilderness, and Attempt 4 died of poison at the Grand Tree door.',
        'At 05:01 UTC on 24 October the operator wrote “attempt 4 is your last attempt”, and at 16:28 “ok fine one more attempt”.',
      ],
      figure: { to: '/attempts', label: 'The attempts timeline' },
    },
    {
      // Source: data/attempts-timeline.json, attempt A5 from 06:56 on 25 October to the S27 stop.
      id: 'twenty-eight-hours',
      title: 'Twenty-eight hours',
      dates: '25–26 Oct',
      notes: [
        `Attempt 5 logged in at 06:56 UTC on 25 October and stopped ${countWord(facts.lastStops)} times on the way to the finish.`,
        'The longest hold began at 09:33, when the Thieving step could not reach its spot: the account stayed logged out for 9 h 08 min, the swarm’s coordinator and its run-host agent posted nothing for 6 h 46 min of it, 23 helper accounts timed out of their 600-minute wait, and the third of three one-off logins finished Thieving in 51 observed ticks.',
        '“Wall clock is free, ticks are not,” the operator wrote at 21:53.',
      ],
      figure: { to: '/attempts', label: 'The attempts timeline' },
    },
    {
      // Source: data/attempts-timeline.json, attempt A5 from 03:36 on 26 October to the official result.
      id: 'the-death',
      title: `The death and the ${fmtInt(record.margin)} ticks`,
      dates: '26 Oct',
      notes: [
        'At 03:36 UTC on 26 October a one-off login walked the account back to the spiders at the S27 site, and the game refused its logout because the account was in combat.',
        'The coordinator ordered a takeover login at 03:39:17, the operator overrode it at 03:39:53 with “Log out!!!”, and the abandoned account died at 03:40:37.',
        `A projection put a finish on the same account at 36,294.9 ticks, 378.9 over the record; the operator answered “we’re not done until #1”, the recovery logged in at 10:27:08, reached Agility 99 at 11:07:53, and the board scored it ${fmtInt(record.final)}.`,
      ],
      figure: { to: '/attempts', label: 'The attempts timeline' },
    },
  ].map(({ notes, ...s }) => ({ ...s, notes: notes.map(capitalize) }));
}
