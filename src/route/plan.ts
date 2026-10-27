import type { Ref } from '../attempts/model';
import type { Skill } from './log';

/*
 * The shape of the Route page: attempt 5 cut into the steps the page tells, each tied to the
 * runner's own step log and the run order's priced rows. The words are in ./prose.ts; everything
 * here is structure that the model (./model.ts) checks against the data.
 */

export interface Stretch {
  id: string;
  numeral: string;
  title: string;
}

export const STRETCHES: readonly Stretch[] = [
  { id: 'first-altar', numeral: 'I', title: 'Fire, rings and the first altar' },
  { id: 'wood-bones-ore', numeral: 'II', title: 'Wood, bones and ore' },
  { id: 'quests-that-fight', numeral: 'III', title: 'Quests that fight' },
  { id: 'monkey-madness', numeral: 'IV', title: 'Monkey Madness' },
  { id: 'charge-and-knights', numeral: 'V', title: 'Charge and the knights' },
  { id: 'sea-altar-river', numeral: 'VI', title: 'Sea, altar and river' },
  { id: 'varrock-west', numeral: 'VII', title: 'Varrock west' },
  { id: 'last-four', numeral: 'VIII', title: 'The last four' },
];

export interface StepSpec {
  id: string;
  stretch: string;
  title: string;
  /**
   * The step's first interval in the runner's log: its launch and the start of its label. A step
   * starts there, or at its session's login where that interval is the session's first, and runs
   * to the next step's start.
   */
  from: { run: number; label: string };
  /** The run order's rows the step covers; its planned figure is theirs. */
  rows: readonly string[];
  /** The skills the step sets out to train, which the rail draws in mid-grey while it runs. */
  trains: readonly Skill[];
  /** Cards on the tricks page, by id. */
  tricks: readonly string[];
  /** Footage from data/clips.json, by id; at most two. */
  clips: readonly string[];
}

export const STEPS: readonly StepSpec[] = [
  /* I */
  {
    id: 'hand-off',
    stretch: 'first-altar',
    title: 'The first trade, and Wind Strike at the coop',
    from: { run: 0, label: 'S00 ' },
    rows: ['S00', 'S01', 'T01-02', 'S02', 'T02-03'],
    trains: ['Magic'],
    tricks: ['fresh-account', 'batched-trade'],
    clips: [],
  },
  {
    id: 'firemaking',
    stretch: 'first-altar',
    title: 'Firemaking on the castle row',
    from: { run: 0, label: 'S03 ' },
    rows: ['S03'],
    trains: ['Firemaking'],
    tricks: ['level-up-dismissal'],
    clips: ['levelup-firemaking'],
  },
  {
    id: 'rings',
    stretch: 'first-altar',
    title: 'Enchanting rings',
    from: { run: 0, label: 'S04 ' },
    rows: ['S04'],
    trains: ['Magic'],
    tricks: ['batched-trade'],
    clips: [],
  },
  {
    id: 'doric',
    stretch: 'first-altar',
    title: 'Doric’s Quest',
    from: { run: 0, label: 'T04-05 ' },
    rows: ['T04-05', 'S05'],
    trains: ['Mining'],
    tricks: ['quest-order', 'dialogue-bursts'],
    clips: [],
  },
  {
    id: 'air-altar',
    stretch: 'first-altar',
    title: 'The air altar',
    from: { run: 0, label: 'T05-06 ' },
    rows: ['T05-06', 'S06', 'T06-07'],
    trains: ['Runecraft'],
    tricks: [],
    clips: [],
  },
  /* II */
  {
    id: 'woodcutting',
    stretch: 'wood-bones-ore',
    title: 'Woodcutting, burying every bone',
    from: { run: 0, label: 'H4k ' },
    rows: ['S07', 'T07a', 'S25b'],
    trains: ['Woodcutting', 'Prayer'],
    tricks: ['knife-reset', 'bury-in-knife-loop', 'knife-on-the-live-server'],
    clips: ['lab-bury'],
  },
  {
    id: 'plague-city',
    stretch: 'wood-bones-ore',
    title: 'Plague City',
    from: { run: 0, label: 'T07-08 ' },
    rows: ['T07-08', 'S08', 'T08-09'],
    trains: ['Mining'],
    tricks: ['dialogue-bursts', 'quest-order'],
    clips: ['lab-dialogue-burst'],
  },
  {
    id: 'mining',
    stretch: 'wood-bones-ore',
    title: 'Mining iron by the zoo',
    from: { run: 0, label: 'mining.iron-63' },
    rows: ['S09'],
    trains: ['Mining'],
    tricks: ['knife-reset', 'logged-out-time'],
    clips: [],
  },
  /* III */
  {
    id: 'tree-gnome-village',
    stretch: 'quests-that-fight',
    title: 'Tree Gnome Village',
    from: { run: 1, label: '(boundary)' },
    rows: ['T09-10', 'S10a', 'S10b'],
    trains: ['Attack', 'Magic'],
    tricks: ['quest-order'],
    clips: [],
  },
  {
    id: 'grand-tree',
    stretch: 'quests-that-fight',
    title: 'The gnome course and The Grand Tree',
    from: { run: 1, label: 'T10-11 ' },
    rows: ['T10-11', 'S11a', 'S11b'],
    trains: ['Agility', 'Attack', 'Magic'],
    tricks: ['quest-order', 'dialogue-bursts'],
    clips: [],
  },
  {
    id: 'fight-arena',
    stretch: 'quests-that-fight',
    title: 'Fight Arena',
    from: { run: 2, label: 'T11-12a ' },
    rows: ['T11-12', 'S12'],
    trains: ['Attack', 'Thieving', 'Magic'],
    tricks: ['quest-order'],
    clips: [],
  },
  {
    id: 'dwarf-cannon',
    stretch: 'quests-that-fight',
    title: 'Dwarf Cannon',
    from: { run: 2, label: 'T12-13a ' },
    rows: ['T12-13', 'S13'],
    trains: ['Crafting'],
    tricks: ['quest-order', 'dialogue-bursts'],
    clips: [],
  },
  {
    id: 'first-cannon',
    stretch: 'quests-that-fight',
    title: 'The cannon at the spiders',
    from: { run: 2, label: 'T13-14a ' },
    rows: ['T13-14', 'S14', 'T14-15'],
    trains: ['Ranged'],
    tricks: ['cannon'],
    clips: [],
  },
  /* IV */
  {
    id: 'monkey-madness',
    stretch: 'monkey-madness',
    title: 'Monkey Madness',
    from: { run: 2, label: 'S15:A-' },
    rows: ['S15'],
    trains: ['Strength', 'Hitpoints', 'Attack', 'Defence'],
    tricks: ['dialogue-client-fix', 'dialogue-bursts'],
    clips: ['lab-dialogue-fixed'],
  },
  /* V */
  {
    id: 'mage-arena',
    stretch: 'charge-and-knights',
    title: 'Mage Arena',
    from: { run: 3, label: 'H13 ' },
    rows: ['T15-16', 'S16', 'T16-18'],
    trains: ['Magic'],
    tricks: ['quest-order'],
    clips: [],
  },
  {
    id: 'knights',
    stretch: 'charge-and-knights',
    title: 'The knights in East Ardougne',
    from: { run: 3, label: 'thieving:knights' },
    rows: ['S18', 'S18b', 'S18c', 'S18d'],
    trains: ['Thieving', 'Magic', 'Fletching'],
    tricks: ['stun-pack', 'charge', 'logged-out-time'],
    clips: ['stun-pack', 'charge-stuns'],
  },
  /* VI */
  {
    id: 'sea-slug',
    stretch: 'sea-altar-river',
    title: 'Sea Slug and the Fishing Contest',
    from: { run: 4, label: 'T18-19 ' },
    rows: ['T18-19', 'S19', 'T19-20', 'S20', 'T20-21'],
    trains: ['Fishing'],
    tricks: ['quest-order'],
    clips: [],
  },
  {
    id: 'body-altar',
    stretch: 'sea-altar-river',
    title: 'The body altar',
    from: { run: 4, label: 'S21 relog:login' },
    rows: ['S21'],
    trains: ['Runecraft'],
    tricks: ['same-page-relog', 'batched-trade'],
    clips: [],
  },
  {
    id: 'fly-fishing',
    stretch: 'sea-altar-river',
    title: 'Fly fishing at Lumbridge',
    from: { run: 6, label: 'T21-22 ' },
    rows: ['T21-22', 'S22', 'T22-23'],
    trains: ['Fishing'],
    tricks: ['knife-reset', 'knife-on-the-live-server'],
    clips: [],
  },
  /* VII */
  {
    id: 'four-quests',
    stretch: 'varrock-west',
    title: 'Cook’s Assistant and three more quests',
    from: { run: 6, label: 'H19 ' },
    rows: ['S23', 'T23-24', 'S24', 'S24 legs', 'T24-25'],
    trains: ['Cooking', 'Crafting', 'Herblore'],
    tricks: ['quest-order', 'dialogue-bursts'],
    clips: [],
  },
  {
    id: 'anvil',
    stretch: 'varrock-west',
    title: 'Smithing at the anvil',
    from: { run: 6, label: 'S25a ' },
    rows: ['S25a'],
    trains: ['Smithing'],
    tricks: ['batched-bank', 'batched-trade'],
    clips: ['lab-bank-pair'],
  },
  {
    id: 'booth',
    stretch: 'varrock-west',
    title: 'The bank booth: Crafting, Herblore, and Cooking by wine',
    from: { run: 6, label: 'H21d ' },
    rows: ['S25d', 'S25e', 'S25c'],
    trains: ['Crafting', 'Herblore', 'Cooking'],
    tricks: ['wine-fermentation', 'same-page-relog'],
    clips: ['wine-relog'],
  },
  /* VIII */
  {
    id: 'dragon-slayer',
    stretch: 'last-four',
    title: 'Dragon Slayer',
    from: { run: 6, label: 'T25-26 ' },
    rows: ['T25-26', 'S26'],
    trains: ['Strength', 'Defence'],
    tricks: ['level-up-dismissal', 'quest-order'],
    clips: [],
  },
  {
    id: 'spiders',
    stretch: 'last-four',
    title: 'The spiders: the cannon, then the bow',
    from: { run: 7, label: 'T26-27a ' },
    rows: ['T26-27', 'S27'],
    trains: ['Defence', 'Ranged', 'Hitpoints'],
    tricks: ['cannon', 'batched-trade'],
    clips: ['finish-rekit', 'finish-cannon'],
  },
  {
    id: 'wilderness-course',
    stretch: 'last-four',
    title: 'The Wilderness Agility Course',
    from: { run: 9, label: 'T27-17 ' },
    rows: ['T27-17', 'S17'],
    trains: ['Agility'],
    tricks: ['quest-order', 'run-host'],
    clips: ['agility-lap', 'finish-agility99'],
  },
];

/* ------------------------------------------------------------------------- */
/* What the runner's log does not hold                                       */
/* ------------------------------------------------------------------------- */

const ev = (utc: string): Ref => ({ event: utc });
const said = (utc: string, says: string, field: 'title' | 'detail' | 'cause_verbatim' = 'title'): Ref => ({ event: utc, says, field });

/**
 * A login the runner never logged: a one-off script between two runner launches, which the
 * timeline records. `ticks` is what the event's own words give, and `tickWords` must appear in
 * them; the arrow login's words give no count, so it is credited none.
 */
export interface ShortLoginSpec {
  id: string;
  /** The runner launch it follows. */
  afterRun: number;
  at: Ref;
  /** When it logged out, where an event states it. */
  end?: Ref;
  ticks: number;
  tickWords: { says: string; field: 'title' | 'detail' } | null;
}

export const SHORT_LOGINS: readonly ShortLoginSpec[] = [
  { id: 'greegree', afterRun: 2, at: ev('2026-10-25T09:11:53Z'), ticks: 3, tickWords: { says: '(3 observed ticks)', field: 'title' } },
  { id: 'thieving-1', afterRun: 3, at: ev('2026-10-25T18:11:57Z'), ticks: 5, tickWords: { says: '(5 ticks)', field: 'title' } },
  { id: 'thieving-2', afterRun: 3, at: ev('2026-10-25T18:35:15Z'), ticks: 0, tickWords: { says: '(0 action ticks)', field: 'title' } },
  { id: 'thieving-3', afterRun: 3, at: ev('2026-10-25T18:41:39.849Z'), ticks: 51, tickWords: { says: '(51 observed ticks)', field: 'title' } },
  { id: 'arrows', afterRun: 4, at: ev('2026-10-25T19:35:31Z'), ticks: 0, tickWords: null },
  {
    id: 'prayer',
    afterRun: 8,
    at: ev('2026-10-26T03:25:55.176Z'),
    end: said('2026-10-26T03:25:55.176Z', '03:26:05.989'),
    ticks: 20,
    tickWords: { says: '(20 ticks)', field: 'title' },
  },
  {
    id: 'return',
    afterRun: 8,
    at: ev('2026-10-26T03:36:26.963Z'),
    // The runner was killed with its logout refused; the body stayed in the world until the death.
    end: said('2026-10-26T03:40:37Z', '03:40:43'),
    ticks: 93,
    tickWords: { says: 'last in world t93', field: 'detail' },
  },
];

/**
 * Where the ticks no log holds are drawn. Between two hiscore stamps, the hiscore can count more
 * ticks than the sessions and the short logins between them hold; that excess is drawn at the one
 * login named here that falls between those stamps, the moment the timeline points to. It stays
 * labelled unassigned: the hiscore fixes how many such ticks lie between the stamps, not where.
 */
export const UNASSIGNED_AT: readonly string[] = ['greegree', 'arrows', 'return'];

/** The story section each logged-out break links to, in order: one per gap between runner launches. */
export const BREAK_STORY: readonly string[] = [
  'twenty-eight-hours',
  'twenty-eight-hours',
  'twenty-eight-hours',
  'twenty-eight-hours',
  'twenty-eight-hours',
  'twenty-eight-hours',
  'twenty-eight-hours',
  'twenty-eight-hours',
  'the-death',
];
