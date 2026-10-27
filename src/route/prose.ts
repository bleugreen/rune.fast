import { fmtInt } from '../lib/numbers';
import { fmtDuration, fmtPacificHm } from '../lib/time';
import type { Skill } from './log';
import type { Break, Route, ShortLogin, Step } from './model';

/*
 * The Route page's words. Every figure in them is one the model holds, passed in and formatted
 * here; the few that are facts of the game or of the run order rather than of this run are in
 * GAME_FACTS, each with where it comes from. src/route/route.test.tsx renders the page and fails
 * on any other number.
 */

/** A paragraph, a clip from data/clips.json, or one of the step's logged-out breaks, by its index in the step. */
export type Block = { p: string } | { clip: string } | { brk: number };

export interface StepWords {
  body(s: Step, r: Route): Block[];
  /** Behind the step's closed Sources disclosure, in plain words. */
  sources(s: Step, r: Route): string[];
}

/** Figures the prose states that belong to the game or the run order, not to this run's data. */
export const GAME_FACTS = {
  /** The level Enchant Lvl-1 Jewellery needs: the run order's coop row. */
  enchantLevel: 7,
  /** A knight's stun, in ticks: the tricks page, Working through the Thieving stun. */
  stunTicks: 11,
  /** Firemaking for Sea Slug's torch: the run order's Firemaking row. */
  torchLevel: 30,
  /** The Grand Tree's climb: the run order's gnome-course row. */
  climbLevel: 25,
  /** Quest points the Champions' Guild door asks: the run order's row for the three Varrock quests. */
  guildPoints: 32,
} as const;

const n = (x: number) => fmtInt(Math.round(x));
const p = (text: string): Block => ({ p: text });
const clip = (id: string): Block => ({ clip: id });
const brk = (i: number): Block => ({ brk: i });
const from = (s: Step, k: Skill) => s.levelsFrom[k];
const to = (s: Step, k: Skill) => s.levelsTo[k];

/** How the step's ticks compare with its price: 'on its price', '95 ticks over its price'. */
export function priceNote(s: Step): string {
  const d = s.took - s.planned;
  if (Math.abs(d) < 1) return 'on its price';
  return `${n(Math.abs(d))} ticks ${d > 0 ? 'over' : 'under'} its price`;
}

const priced = (s: Step) =>
  `The run order priced the step’s rows (${s.rows.map((r) => r.id).join(', ')}) at ${fmtInt(s.planned)} ticks; on the hiscore’s clock it took ${n(s.took)}, from its first logged interval to the next step’s.`;
const HANDOFFS =
  'The run order prices its hand-offs, the trades that open most steps, in its allowances rather than in the rows, so they sit in the ticks taken and not in the price.';

export const WORDS: Readonly<Record<string, StepWords>> = {
  'hand-off': {
    body: (s) => [
      p(
        'The account was new, made for this attempt, and the server let it skip the tutorial island in one conversation with the guide. On its first tick in Lumbridge a helper account was already waiting with a trade open: a staff and the runes for everything the first hour would cast. It dropped the starter kit’s junk as it ran, since a drop doesn’t stop a walk, and went to the chicken coop north of the castle.',
      ),
      p(
        `Four Wind Strikes on the chickens took Magic past ${GAME_FACTS.enchantLevel}, the level the first ring enchantment needs. That is the whole reason for the stop: the steps that follow cast spells, and they need Magic to begin.`,
      ),
    ],
    sources: (s) => [
      'The tutorial skip: the tricks page, A fresh account that skips the tutorial.',
      'The first trade, and the Magic the ring step needs: the run order’s rows for the first hand-off, the coop and the rings.',
      priced(s),
    ],
  },
  firemaking: {
    body: (s) => [
      p(
        `Firemaking needs nothing but a tinderbox and logs, and the run took it from ${from(s, 'Firemaking')} to ${to(s, 'Firemaking')} in one pass along the tiles outside Lumbridge Castle. Helper accounts stood beside the row and dropped logs on the tiles ahead. The account lit each log where it lay and stepped to the next, at a steady four ticks a log once its level made the lighting quick. A dropped log becomes anyone’s to take after a hundred ticks, so the droppers kept only a little ahead of the flames.`,
      ),
      clip('levelup-firemaking'),
      p(
        `It comes first because it depends on nothing. One quest much later, Sea Slug, needs Firemaking ${GAME_FACTS.torchLevel} to light a torch. The step ran ${priceNote(s)}, and Firemaking was the run’s first 99.`,
      ),
    ],
    sources: (s) => [
      'The droppers, the four-tick line and the hundred-tick rule for dropped logs: the run order’s Firemaking row.',
      'Answering each level-up page in the tick it opens: the tricks page, Answering the level-up page at once.',
      priced(s),
    ],
  },
  rings: {
    body: (s) => [
      p(
        'Enchanting rings is the quickest Magic a new account can do. Each level it gives here opens a spell the route casts next. Three helpers stood at the end of the castle row with sapphire, emerald, ruby and diamond rings; the account enchanted sixty and traded them back as it went.',
      ),
      p(
        `At Magic ${to(s, 'Magic')} it could teleport to Falador, Camelot and Ardougne, the jumps that carry it between most of the steps that follow, and cast Fire Blast, the spell the first quest that fights is won with. The run order had weighed casting on the walk to the next quest instead, and measured it slower than standing still and teleporting after.`,
      ),
    ],
    sources: (s) => [
      'The sixty enchants, the three ring givers, and the walk measured slower: the run order’s ring row.',
      'The Magic each later step needs: the same row’s gates, and the rows for Doric’s Quest, Plague City and Tree Gnome Village.',
      priced(s),
    ],
  },
  doric: {
    body: (s) => [
      p(
        `Quest rewards are the cheapest levels on the route. Doric’s Quest asks for a handful of ore and three conversations, and its reward lifts Mining from ${from(s, 'Mining')} to ${to(s, 'Mining')} at once. A helper met the account at Doric’s house with the ores, and in the same trade the account handed back the last of the enchanted rings.`,
      ),
      p(
        'Where a conversation offered no choice, the account didn’t read it page by page: it clicked through blind, five continues in one tick, the most the server accepts. Every quest on the route was talked through that way.',
      ),
    ],
    sources: (s) => [
      'The ores, the ring hand-back and the reward: the run order’s row for Doric’s Quest.',
      'Five continues in one tick: the tricks page, Five dialogue clicks in one tick.',
      priced(s),
    ],
  },
  'air-altar': {
    body: (s) => [
      p(
        `The air altar is the first a new account can use, and the route went there early because of who was waiting. Seven helper accounts stood in the altar room with essence. The account took a load from one, crafted it, and traded with the next, seven loads in all, which took Runecraft to ${to(s, 'Runecraft')}.`,
      ),
      p('The rest of Runecraft waited for a better altar, much later in the route, when more helpers could be lined up for it.'),
    ],
    sources: (s) => ['The seven altar givers and the seven crafts: the run order’s row for the air altar.', priced(s)],
  },
  woodcutting: {
    body: (s) => [
      p(
        'Woodcutting is the longest gathering skill on the route, and the run made it carry Prayer as well. A woodcutting roll comes every few ticks whatever the player does in between. One tick after each roll the account used a knife on its logs, chose a fletching option and dropped a log, which brings the next roll sooner; and in that same moment there was room to bury a bone. Helpers stood at the tree and traded fresh bones whenever the pack ran low.',
      ),
      clip('lab-bury'),
      p(
        `Prayer reached 99 before Woodcutting did. Doing it here, rather than as a step of its own at a bank, put Protect from Melee within reach before the quests that fight, and all of them are fought under it. The step ran ${priceNote(s)}.`,
      ),
    ],
    sources: (s) => [
      'The knife on the logs, and the next roll three ticks after the last: the tricks page, The knife-on-logs reset.',
      'Burying in the knife loop, and Prayer 99 inside the woodcutting step: the tricks page, Burying bones between woodcutting rolls.',
      'Prayer moved into the woodcutting step from the bank booth, and Protect from Melee available from here on: the run order’s rows for woodcutting, burying and the first cannon session.',
      priced(s),
    ],
  },
  'plague-city': {
    body: (s) => [
      p(
        `Plague City is mostly talking, twenty-six short errands around West Ardougne. Its reward lifts Mining from ${from(s, 'Mining')} to ${to(s, 'Mining')}, but the quest is here for what it teaches at the end: the Ardougne teleport. From here on the route uses that teleport more than any other, for the Fight Arena, the cannon quest, the spiders and the knights.`,
      ),
      clip('lab-dialogue-burst'),
    ],
    sources: (s) => [
      'The quest’s errands are the step log’s twenty-six segments, A to Z.',
      'The Ardougne teleport read at the end, and the Magic the quest needs from the ring step: the run order’s Plague City row.',
      'The teleport’s later use: the run order’s legs to the Fight Arena, Dwarf Cannon, the spiders and the knights.',
      priced(s),
    ],
  },
  mining: {
    body: (s) => [
      p(
        'Mining works like the axe: a knife on a log between swings brings the next swing sooner. The account mined iron at the six rocks south of the Ardougne zoo, a short teleport from where Plague City ends.',
      ),
      p(
        `Other bots wanted the same rocks. Soon after the step began another group crowded the cluster, the account’s script tried two other sites, found them taken too, and logged out. The swarm’s lead agent ruled that it should wait rather than walk back into the same contest, since a wait logged out costs nothing, and ${fmtDuration(s.breaks[0]!.to - s.breaks[0]!.from)} later the account logged back in and finished the band.`,
      ),
      brk(0),
      p(`The step ran ${priceNote(s)}.`),
    ],
    sources: (s) => [
      'The knife on the log between swings: the tricks page, The knife-on-logs reset.',
      'The six rocks south of the zoo: the run order’s Mining row.',
      'The contest, the two other sites and the ruling to wait: attempt 5’s timeline, the stop at the iron rocks and the lead agent’s ruling after it.',
      priced(s),
    ],
  },
  'tree-gnome-village': {
    body: (s) => [
      p(
        'The three quests in this stretch each end in a fight, and each pays its reward in combat skills, which is why the route takes them while those skills are still at nothing.',
      ),
      p(
        `Tree Gnome Village sends the account through a maze and a ballista puzzle to a Khazard warlord, and the account fought him as it fought everything on the route, with spells, from under Protect from Melee so that his blows did nothing. The reward took Attack from ${from(s, 'Attack')} to ${to(s, 'Attack')}.`,
      ),
    ],
    sources: (s) => ['The warlord by Fire Blast under Protect from Melee, and the reward: the run order’s Tree Gnome Village row.', priced(s)],
  },
  'grand-tree': {
    body: (s) => [
      p(
        `The Grand Tree’s climb needs Agility ${GAME_FACTS.climbLevel}, and the account had none, so it ran laps of the Gnome Stronghold’s course until it got there: the only plain training in this stretch. The quest then pays Agility in its reward, up to ${to(s, 'Agility')}, which is why the Agility course at the very end of the route starts there and not at 1.`,
      ),
      p(
        'Then a click went missing. Partway through, a cupboard search didn’t register: the script had sent the click once and waited for a result that never came. The account logged out; when it logged back in, the search took on the first try.',
      ),
      brk(0),
      p('The quest’s demon fell to Fire Bolt, under Protect from Melee like every fight before it.'),
    ],
    sources: (s) => [
      'The climb’s Agility, the laps to reach it, and the reward: the run order’s rows for the gnome course and The Grand Tree.',
      'The cupboard search sent once, and the search passing on the first try after the resume: attempt 5’s timeline.',
      priced(s),
    ],
  },
  'fight-arena': {
    body: (s, r) => [
      p('Fight Arena is three fights in General Khazard’s arena, and the account won them the same way, with Fire Blast from under Protect from Melee.'),
      p(
        `Its reward is the reason for its place. It finishes Attack, the run’s ${ordinal(r, 'Attack')} 99, and it gives Thieving ${to(s, 'Thieving')}, enough to pickpocket the Ardougne knights, which is where the route trains the rest of Thieving.`,
      ),
    ],
    sources: (s) => ['The fights and the reward: the run order’s Fight Arena row.', 'Thieving trained at the knights from that level: the run order’s knights row.', priced(s)],
  },
  'dwarf-cannon': {
    body: (s) => [
      p(
        `Dwarf Cannon earns the multicannon, and the route needs the cannon twice: for Ranged at the spiders straight after, and again near the very end. Its reward also lifts Crafting from ${from(s, 'Crafting')} to ${to(s, 'Crafting')}.`,
      ),
      p(
        `Most of its time goes on mending the railings of the dwarves’ camp, where each repair is a roll that can fail, so the step’s length is partly luck. This time it ran ${priceNote(s)}.`,
      ),
    ],
    sources: (s) => ['The railings, each repair a roll, and the cannon’s two sessions: the run order’s rows for Dwarf Cannon and the two cannon steps.', priced(s)],
  },
  'first-cannon': {
    body: (s) => [
      p(
        'The cannon trains Ranged on its own. Once it is set down and loaded it fires at whatever is near, and its hits count for the player who set it. A helper carried the four pieces and the cannonballs to the poison spiders in the Wilderness; the account set the cannon up, stood beside it with auto-retaliate off, and picked it up again.',
      ),
      p(
        `It stopped at Ranged ${to(s, 'Ranged')}, the level the magic shortbow needs. The bow waits for the last stretch; this short session only buys the level for it.`,
      ),
    ],
    sources: (s) => [
      'The helper with the cannon and the balls: the tricks page, A cannon carried by a helper, and the run order’s first cannon row.',
      'The magic shortbow from Ranged 50: the run order’s row for the spiders near the end.',
      priced(s),
    ],
  },
  'monkey-madness': {
    body: (s) => [
      p(
        `Monkey Madness is the longest quest on the route and the most valuable: its reward took Strength to ${to(s, 'Strength')} and Defence to ${to(s, 'Defence')} in one step, and Hitpoints with them. Most of it is conversation, across the gnome stronghold, Ape Atoll and the atoll’s jail.`,
      ),
      clip('lab-dialogue-fixed'),
      p(
        `The swarm’s client answers a dialogue page in the tick it appears, where the standard client takes two ticks a page, and with that fix the quest ran ${priceNote(s)}.`,
      ),
      p(
        'At its end the hand-off for the next step was refused, one slot short: the account came out of the quest with more sharks than the plan had assumed. It logged out, a short login dropped the monkey greegree to free the slot, and the run went on.',
      ),
      brk(0),
    ],
    sources: (s) => [
      'The reward’s four skills: the run order’s Monkey Madness row.',
      'One tick a page: the tricks page, One tick per dialogue page, not two.',
      'The refused hand-off, the sharks left over, and the greegree login: attempt 5’s timeline.',
      'The run order’s row for the quest notes that its price was due to be measured again; it is the figure as it stood.',
      priced(s),
    ],
  },
  'mage-arena': {
    body: (s) => [
      p(
        'The Mage Arena is here for one spell. Beating Kolodion, the battle mage who keeps the arena, earns the right to cast Charge, and Charge is what the next step trains Magic with. The account fought him in the deep Wilderness with Fire Wave, under Protect from Magic.',
      ),
      p(`It came out at Magic ${to(s, 'Magic')}. The step ran ${priceNote(s)}, most of it in the arena itself.`),
    ],
    sources: (s) => [
      'Kolodion under Protect from Magic with Fire Wave, and Charge as the reward: the run order’s Mage Arena row.',
      'The arena against its row: the step log’s intervals for the fight and the arena’s other segments.',
      HANDOFFS,
      priced(s),
    ],
  },
  knights: {
    body: (s) => [
      p(
        `Pickpocketing a knight fails now and then, and the knight stuns the thief for ${GAME_FACTS.stunTicks} ticks. A stunned account can’t steal, but it can still cast spells and fletch arrows, so the route trained Magic and Fletching inside those stuns. In the lab, Thieving took about as long with the stuns filled as with them left empty, and the other two skills came along almost free.`,
      ),
      clip('stun-pack'),
      p(
        `Magic went first. Charge, a spell that can be cast again on the very next tick, took it to ${to(s, 'Magic')} at one or two casts a stun. Then the stuns went to Fletching, which climbed from nothing by putting heads on arrows. Stuns also went to Superheat, two casts on iron ore at a time, which lifted Smithing to ${to(s, 'Smithing')} and saved that much work at the anvil later. A courier account on the next tile traded in the first load of runes and ore, so the account never walked to a bank; the top-ups it was there to bring never came, and Superheat ran out of ore.`,
      ),
      clip('charge-stuns'),
      p(
        'The step sits here because of what comes before and after it. The Mage Arena, just before, is the quest that teaches Charge, and the Fight Arena had already left Thieving high enough for the knights. The rune arrows fletched here are the ones the account fires at the spiders near the end.',
      ),
      p(
        `Thieving stopped two pickpockets short and the account logged out for ${hoursWord(s.breaks[0]!)}; three short logins finished it. The step ran ${priceNote(s)}, and the ${hoursWord(s.breaks[0]!)} cost nothing.`,
      ),
      brk(0),
    ],
    sources: (s) => [
      'The stun, the lab comparison and the courier: the tricks page, Working through the Thieving stun.',
      'Charge recast with no wait, one or two casts a stun: the tricks page, Charge, recast with no cooldown.',
      'Charge first, then the arrows; Superheat for Smithing; the rune arrows kept for the spiders: the run order’s rows for the knights and the spiders.',
      'The courier’s one hand-off and no top-up after it, and Smithing’s last level-up in the step: the step log, and attempt 5’s timeline, the stop at the knights.',
      `The run order priced the knights at ${fmtInt(s.rows[0]!.expected)} ticks in the step’s own row, and ${fmtInt(s.rows[0]!.scenario[0]!.ticks)} more for the courier’s top-ups, which the row leaves to its scenario table.`,
      'Two pickpockets short, and the three logins: attempt 5’s timeline and the story’s fifth section.',
      priced(s),
    ],
  },
  'sea-slug': {
    body: (s) => [
      p(
        `Two quests that pay in Fishing open the second day. Sea Slug, on the platform off Witchaven, lifts Fishing from ${from(s, 'Fishing')} to the seventies in one reward; the torch it needs lit is why Firemaking came first.`,
      ),
      p(
        `The Fishing Contest takes it to ${to(s, 'Fishing')}, and it is the one quest the helpers couldn’t shorten: its bait and its winning carp can’t be traded. So the account dug its own worm, put garlic in the pipe to move the angler off the best spot, and caught the carp itself.`,
      ),
    ],
    sources: (s) => [
      'The two rewards, the torch, and the carp that cannot be traded: the run order’s rows for Sea Slug, the Fishing Contest and Firemaking.',
      priced(s),
    ],
  },
  'body-altar': {
    body: (s) => [
      p(
        'The body altar stands in for the nature altar the run order first planned, because no nature talismans could be had. It is slower, and the run order priced the difference. Before the account went in, it logged out and straight back in, so that the altar’s helpers could log in during the wait without spending any of its ticks.',
      ),
      p(
        'The first try was refused: the account still carried rune arrows from the knights, and the altar step needs a nearly empty pack. A fault in the runner then sent it walking toward a woodcutting tile from the first morning before it logged out. A short login equipped the arrows, which emptied their slot, and the next launch went straight to the altar.',
      ),
      brk(0),
      p(
        `Then a rota of helper accounts took turns trading it essence, each load crafted at once and the next trade already open, and Runecraft went from ${from(s, 'Runecraft')} to ${to(s, 'Runecraft')}. The account logged out after the last craft, as planned.`,
      ),
      brk(1),
    ],
    sources: (s) => [
      `The body altar in force, and the ${fmtInt(s.rows[0]!.scenario[0]!.ticks)} ticks it adds to the nature altar’s ${fmtInt(s.rows[0]!.expected)}: the run order’s altar row.`,
      'The relog before the altar, so the helpers can log in first: the run order’s altar row, and the tricks page, A relog that sees the world on its first tick.',
      'The refusal, the wrong walk and the arrow login: attempt 5’s timeline.',
      priced(s),
    ],
  },
  'fly-fishing': {
    body: (s) => [
      p(
        `Fly fishing on the river at Lumbridge finished Fishing, at ${to(s, 'Fishing')}, with the same trick as the axe and the pickaxe: a knife on a log between catches brings the next cast sooner. The account dropped every fish; nothing from this step is used later.`,
      ),
      p(`It ran ${priceNote(s)}.`),
    ],
    sources: (s) => ['The knife loop on the river, and the fish dropped: the run order’s fly-fishing row.', priced(s)],
  },
  'four-quests': {
    body: (s) => [
      p(
        `These four quests are here for their quest points. Dragon Slayer, two steps on, starts inside the Champions’ Guild, whose door opens at ${GAME_FACTS.guildPoints} quest points, and with these four the account arrived with exactly that many and none to spare.`,
      ),
      p(
        `Their rewards help too. Cook’s Assistant gives Cooking its first ${to(s, 'Cooking')} levels. Druidic Ritual is what lets an account train Herblore at all, and its reward starts it at ${to(s, 'Herblore')}. Goblin Diplomacy and Romeo and Juliet are there for the points alone.`,
      ),
    ],
    sources: (s) => [
      'The quest points, none spare at the guild door: the run order’s row for the three Varrock quests.',
      'The rewards: the run order’s rows for Cook’s Assistant and the three quests.',
      priced(s),
    ],
  },
  anvil: {
    body: (s) => [
      p(
        'Smithing at the anvil in west Varrock is the plainest step on the route. A helper stood beside the anvil and traded bars, and the account hammered them into platebodies, a load at a time.',
      ),
      p(
        `Its price assumed the account would arrive at Smithing in the mid-fifties, from the Superheat casts at the knights. It arrived at ${from(s, 'Smithing')}: the knights’ courier never managed a top-up, so the casts ran out of ore. The run order had taken the casts’ worth off the anvil’s price, and the step ran ${priceNote(s)}, about that much.`,
      ),
    ],
    sources: (s) => [
      'The bars traded at the anvil, and the price net of the Superheat casts at the knights: the run order’s anvil row.',
      'The courier that served no top-up: attempt 5’s timeline, the stop at the knights.',
      priced(s),
    ],
  },
  booth: {
    body: (s, r) => [
      p(
        `The last three skills that aren’t fought for finished within ${secondsWord(r, 'Herblore', 'Cooking')} of each other at a bank booth in west Varrock, and the order inside the step is the trick. Crafting and Herblore went first, from supplies a helper traded in: leather bodies and potions, made at the booth and banked as they came.`,
      ),
      clip('lab-bank-pair'),
      p(
        'Cooking came last, by wine. A jug of wine ferments on a timer after it is made, and the game pays the Cooking when it ferments without checking the cook’s level. A helper had brewed hundreds of jugs and left them unfermented; the account banked them and let the timer ferment them all at once, cutting gems for Crafting while it waited.',
      ),
      clip('wine-relog'),
      p(`The first firing took Cooking to the sixties and the second, one relog later, to ${to(s, 'Cooking')}.`),
    ],
    sources: (s) => [
      'The wine banked unfermented, and the two firings a relog apart: the tricks page, Wine that ferments without a Cooking check, and the run order’s wine row.',
      'Leather bodies for Crafting, because no diamonds could be had, and the price that adds: the run order’s Crafting row.',
      'Banking five clicks a tick at the booth: the tricks page, Banking five clicks at a time.',
      priced(s),
    ],
  },
  'dragon-slayer': {
    body: (s) => [
      p(
        `Dragon Slayer is the last of the big quest rewards: it finishes Strength at ${to(s, 'Strength')} and takes Defence most of the way. It is long, a maze, a voyage and a dragon, and the account went through it in rune armour bought from the guild’s own shop on the way in.`,
      ),
      p(
        'When Elvarg died, the quest’s reward and the level-up page for Strength 99 came up together. The runner’s check after the fight found a page still open, stopped, and logged out. A few minutes later the account logged back in, closed the page, and went on.',
      ),
      brk(0),
    ],
    sources: (s) => [
      'The reward, the armour from the guild’s shop, and the quest’s segments: the run order’s Dragon Slayer row.',
      'The page left open, and the resume: attempt 5’s timeline.',
      priced(s),
    ],
  },
  spiders: {
    body: (s) => [
      p(
        'The last combat skills train together at the poison spiders. The cannon does most of the work for Ranged; the account meleed beside it with a scimitar until Defence reached 99, then switched to the magic shortbow and fired the rune arrows it had fletched at the knights. Hitpoints rises with every hit, so it finished here too, without a step of its own.',
      ),
      brk(0),
      brk(1),
      p(
        'Overnight the helpers rebuilt the lost kit, and in the first seconds after the recovery login two of them traded it across. The account ran back to the spiders, set the cannon down again and finished all three skills.',
      ),
      clip('finish-rekit'),
      clip('finish-cannon'),
      p(
        `The step ran ${priceNote(s)}. The hatched stretch is ${n(s.composition.unassigned)} of them: ticks the hiscore counted while the body stood at the spiders, which no log holds and the swarm could not place.`,
      ),
    ],
    sources: (s) => [
      'Defence with the scimitar, then the bow from Defence 99, and Hitpoints as a by-product: the run order’s row for the spiders.',
      'The stops, the short logins and the death: attempt 5’s timeline, and the story’s fifth and sixth sections.',
      'The hatched ticks: what the hiscore counted between Strength 99 and Defence 99 beyond the sessions and short logins, drawn where the body stood.',
      priced(s),
    ],
  },
  'wilderness-course': {
    body: (s) => [
      p(
        `The route ends on the Wilderness Agility Course: laps of five obstacles in the deep Wilderness, from Agility ${from(s, 'Agility')} to ${to(s, 'Agility')}. It is last for two reasons. A clean lap can’t be run any faster, so all that varies is how often the account falls, and nothing else on the route waits on it. And the hiscore stops counting at the last level-up, so a step that ends on one and logs out in the same tick spends nothing after it.`,
      ),
      clip('agility-lap'),
      p(`The account fell less often than the run order’s simulation expected, and the step ran ${priceNote(s)}.`),
      clip('finish-agility99'),
    ],
    sources: (s) => [
      'The clean lap as the floor, falls as the only variation, and the free logout after the last level-up: the run order’s row for the course.',
      'Agility moved to the end: the tricks page, Quests picked for what they unlock.',
      priced(s),
    ],
  },
};

/** 'fifth': the skill's place in the order the 99s came. */
export function ordinal(r: Route, skill: Skill): string {
  const i = r.stamps.findIndex((s) => s.skill === skill);
  return ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][i] ?? `${i + 1}th`;
}

/** 'nine hours', the break's length in whole hours. */
function hoursWord(b: Break): string {
  const h = Math.floor((b.to - b.from) / 3_600_000);
  return `${['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][h] ?? String(h)} hours`;
}

/** 'half a minute': how far apart two skills' 99s fell, in wall-clock terms at the server's tick. */
function secondsWord(r: Route, a: Skill, b: Skill): string {
  const ticks = r.stamps.find((s) => s.skill === b)!.tick - r.stamps.find((s) => s.skill === a)!.tick;
  const s = (ticks * r.tickMs) / 1000;
  if (s > 60) throw new Error(`${a} and ${b} are ${s} s apart`);
  return s <= 30 ? 'half a minute' : 'a minute';
}

/* ------------------------------------------------------------------------- */
/* Breaks                                                                    */
/* ------------------------------------------------------------------------- */

/** What a short login inside a break did, in a few words, with its ticks. */
export function loginWords(l: ShortLogin, r: Route): string {
  const un = l.unassigned ? `, and ${n(l.unassigned)} more that no log holds` : '';
  switch (l.id) {
    case 'greegree':
      return `a login of ${n(l.ticks)} ticks to drop the greegree${un}`;
    case 'arrows':
      return `a login to equip the rune arrows, whose ${n(l.unassigned)} ticks no log holds`;
    case 'prayer':
      return `${n(l.ticks)} ticks to drink a prayer potion brought to the spiders; the protection prayer never switched on, and it logged out`;
    case 'return':
      return `${n(l.ticks)} ticks to walk back to the cannon spot; the logout was refused in combat, the runner was stopped, and the body stood among the spiders until they killed it: ${n(l.unassigned)} ticks the hiscore counted that no log holds, about ${n(Math.round(deathWallTicks(l, r) / 10) * 10)} by the wall clock`;
    default:
      return `a login of ${n(l.ticks)} ticks`;
  }
}

/** The ticks the wall clock gives the body's stand, from the end of the logged walk to the logout after the death. */
export function deathWallTicks(l: ShortLogin, r: Route): number {
  return (l.end! - l.at) / r.tickMs - l.ticks;
}

/** The short logins a break holds without stating when each ended, as one phrase. */
export function groupWords(logins: readonly ShortLogin[], r: Route): string {
  if (logins.length === 1) return loginWords(logins[0]!, r);
  const ticks = logins.reduce((s, l) => s + l.ticks + l.unassigned, 0);
  if (logins.every((l) => l.id.startsWith('thieving'))) return `three short logins for the last two pickpockets, ${n(ticks)} ticks`;
  return `${logins.length} short logins, ${n(ticks)} ticks`;
}

export const clockTime = fmtPacificHm;

/* ------------------------------------------------------------------------- */
/* The opening and the finish                                                */
/* ------------------------------------------------------------------------- */

const HOURS_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const MINUTE_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The shortest and the longest logged-out stretch, as words: 'four minutes', 'nine hours'. */
export function stretchWords(r: Route): [string, string] {
  const outs = r.breaks.flatMap((b) => b.parts.flatMap((x) => (x.kind === 'out' ? [x.to - x.from] : [])));
  const min = Math.floor(Math.min(...outs) / 60_000);
  const max = Math.floor(Math.max(...outs) / 3_600_000);
  return [`${MINUTE_WORDS[min] ?? min} minutes`, `${HOURS_WORDS[max] ?? max} hours`];
}

export interface OpeningFacts {
  /** The attempt as the timeline names it. */
  name: string;
  start: number;
  last99: number;
  /** The operator's words, as the timeline quotes them. */
  quote: string;
}

export function opening(r: Route, f: OpeningFacts, days: { start: string; end: string }, zone: string): string[] {
  const wallHours = Math.floor((f.last99 - f.start) / 3_600_000);
  const scoredHours = (r.finish * r.tickMs) / 3_600_000;
  const under = Math.ceil(scoredHours);
  const [shortest, longest] = stretchWords(r);
  return [
    `The hiscore this record stands on does not time an account by the wall clock. It counts the game ticks the account spends logged in, ${r.tickMs / 1000} seconds each, up to the tick of its last level-up, and while the account is logged out the count stands still. Attempt 5 logged in at ${clockTime(f.start)} ${zone} on ${days.start} and reached its last 99 at ${clockTime(f.last99)} on ${days.end}, ${wallHours} hours later. The hiscore counted ${n(r.finish)} ticks, just under ${HOURS_WORDS[under]} of those hours.`,
    `The swarm planned the route around that rule, and the operator put it plainly on the Sunday afternoon: “${f.quote}”. When something went wrong, the account logged out and waited, and the wait cost nothing. It fetched almost nothing for itself, because helper accounts met it with supplies at nearly every step, so its logged-in ticks went to training. Where one skill left it standing idle, the route put another skill in the gap.`,
    `This page follows the ${n(r.finish)} ticks in order. The line down the left is the hiscore’s clock. Scrolling moves the run forward, and where the account was logged out the line breaks, and the break takes the same small room whether the wait was ${shortest} or ${longest}. As you go, the ${r.stamps.length} skills climb to 99 as the run’s own log recorded them. Before the attempt, the swarm’s run order priced every step in ticks; I have grouped its steps into ${HOURS_WORDS[r.stretches.length]} stretches, and for each I say what the account did, why it came at that point, what the plan expected it to cost and what it took. The stops, the death and the recovery show here only as breaks in the line, each linked to the story, which tells them.`,
  ];
}

/** The finish's words: before the drift chart, and between it and the ledger. */
export function finishWords(r: Route): { before: string[]; middle: string[] } {
  const margin = r.record - r.finish;
  const drift = [...new Set(r.stampDrift.map((s) => s.drift))].filter((d) => d > 0);
  const firstAt = (d: number) => r.stampDrift.find((s) => s.drift === d)!.skill;
  const lastEven = [...r.stampDrift].reverse().find((s) => s.drift === 0)!.skill;
  const death = r.segments.find((g) => g.kind === 'unassigned' && g.login === 'return')!;
  const deathLogin = r.logins.find((l) => l.id === 'return')!;
  const [a, b] = death.kind === 'unassigned' ? death.bracket : [null, null];
  return {
    before: [
      `Agility reached 99 on tick ${n(r.finish)} of the hiscore’s clock, and the account logged out in the same tick. The record it beat was ${n(r.record)}, so the margin was ${n(margin)} ticks, about ${n((margin * r.tickMs) / 1000)} seconds.`,
      `The run order, as it stood when the attempt logged in, expected ${n(r.planTotal)} ticks for the whole route. The run took ${n(r.finish - r.planTotal)} more, and still beat the record.`,
      `The swarm kept its own count as the run went, from the runner’s sessions and the short logins it knew of, and it came to ${n(r.ledger.swarm)}, which is ${n(r.ledger.residual)} fewer than the hiscore. The hiscore’s own stamps show where the difference lies. Up to ${lastEven} 99 the two clocks agree to the tick. The greegree login puts the hiscore ${n(drift[0]!)} ahead by ${firstAt(drift[0]!)} 99, the next morning’s logins ${n(drift[1]!)} by ${firstAt(drift[1]!)} 99, and the window around the death ${n(drift[2]!)} by ${firstAt(drift[2]!)} 99; after that the two never move apart again.`,
    ],
    middle: [
      `Of the ${n(r.ledger.residual)}, ${n(r.ledger.unassigned)} are ticks no log holds. The stamps bracket them, and ${n(death.to - death.from)} fall between ${a} 99 and ${b} 99: the window in which the account’s body stood at the spiders after its controller had been stopped, long enough by the wall clock for about ${n(Math.round(deathWallTicks(deathLogin, r) / 10) * 10)} ticks. That fits, but it is a bracket and not a measurement, so the page draws those ticks hatched and calls them unassigned.`,
    ],
  };
}

/** The ledger's rows, in words, as the finish's table prints them. */
export const LEDGER_WORDS: Readonly<Record<string, string>> = {
  swarm: 'The swarm’s ledger: its runner sessions and the short logins it counted',
  unassigned: 'Ticks no log holds, in three brackets of the hiscore’s stamps',
  'short-logins': 'Short-login ticks the timeline gives and the ledger did not count',
  'after-finish': 'The last session tick, after Agility 99, which the hiscore does not count',
  residual: 'Not accounted for',
  hiscore: 'The hiscore',
};
