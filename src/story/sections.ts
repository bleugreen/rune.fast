import type { DraftSection, Story, StoryBlock } from './draft';

/** A figure the page sets between two blocks of a section's prose. */
export type StoryFigure =
  /** The record against this run, in ticks. */
  | { kind: 'ladder' }
  /** A 10-15 s clip from data/clips.json; with no id yet, a slot that links to the tricks page. */
  | { kind: 'clip'; id?: string }
  /** The cost page's day chart, linked. */
  | { kind: 'cost' }
  /** The attempts chart, cropped to the section's hours (instants given in UTC; the chart reads Pacific). */
  | { kind: 'timeline'; crop: readonly [string, string] }
  /**
   * A still under public/, served as WebP with a PNG fallback: `src` names both files less
   * the extension, and `width` and `height` are their pixels. `takenBefore` (UTC) is the
   * latest instant the picture can have been taken, which is all its evidence fixes.
   */
  | {
      kind: 'image';
      src: string;
      width: number;
      height: number;
      alt: string;
      caption: string;
      source: string;
      takenBefore: string;
    };

interface SectionMeta {
  /** The section's anchor on the page. */
  id: string;
  /** Pacific, as the prose dates things; the draft's headings carry no dates. */
  dates: string;
  /** Each figure follows the one block of prose that contains its `after` text; the first is the section's own figure. */
  figures: readonly { figure: StoryFigure; after: string }[];
  /**
   * The operator's short lines, set again in the margin beside the block that
   * carries them: either quoted inline in a paragraph (the text between the double
   * quotes, exactly) or a quoted message ('> ' block) that contains them.
   */
  pulled: readonly string[];
  /** Words in the prose that link out; each target is also in the section's sources. */
  links: readonly { text: string; href: string }[];
}

/** What the page adds to each of the draft's sections, in the draft's order. */
export const SECTION_META: readonly SectionMeta[] = [
  {
    id: 'the-number',
    dates: '20 Oct 2026',
    figures: [{ figure: { kind: 'ladder' }, after: 'The number that never moved was 35,916 ticks' }],
    pulled: ['sounds like a plan', 'Sure!', 'absolutely! Swarm out my guy :)'],
    links: [{ text: 'RuneScape Bench: MMOs for Agents', href: 'https://www.youtube.com/watch?v=cNm4zyUtWj0' }],
  },
  {
    id: 'the-tricks',
    dates: '20–21 Oct',
    figures: [{ figure: { kind: 'clip' }, after: 'had the wine script open' }],
    pulled: [],
    links: [],
  },
  {
    id: 'the-swarm',
    dates: '21–22 Oct',
    figures: [{ figure: { kind: 'cost' }, after: 'The day cost $5,448' }],
    pulled: [],
    links: [],
  },
  {
    id: 'four-attempts',
    dates: '23–24 Oct',
    figures: [
      { figure: { kind: 'timeline', crop: ['2026-10-23T17:00Z', '2026-10-24T17:00Z'] }, after: 'ok fine one more attempt' },
      // Attempt 4's death at the tree door, which the paragraph before the quotation narrates.
      { figure: { kind: 'clip', id: 'attempt-4-death' }, after: 'ok fine one more attempt' },
    ],
    pulled: ['ok fine one more attempt'],
    links: [],
  },
  {
    id: 'twenty-eight-hours',
    dates: 'Sat 24–Sun 25 Oct',
    figures: [
      { figure: { kind: 'timeline', crop: ['2026-10-25T06:00Z', '2026-10-25T22:00Z'] }, after: 'Attempt 5 logged in' },
      // Elvarg's fight ending and the Strength 99 page the run stopped on, after the paragraph that narrates it.
      { figure: { kind: 'clip', id: 'dragon-slayer-stop' }, after: 'Five minutes later Elvarg was dead and the run had stopped' },
      // The 2:34 PM stop at the spiders with no prayer. Its paragraph ends in a colon, so the clip follows the quotation it introduces.
      { figure: { kind: 'clip', id: 'spider-stop' }, after: 'builder is overestimating, wall clock is free, ticks are not' },
    ],
    pulled: ['wall clock is free, ticks are not'],
    links: [],
  },
  {
    id: 'the-death',
    dates: '25–26 Oct',
    figures: [
      { figure: { kind: 'clip', id: 'finish-agility99' }, after: 'incredible work couldn’t have done it without you' },
      // The board behind the #1 paragraph. That paragraph ends in a colon, so the board follows the
      // quotation it introduces, after the Agility clip: the level-up came first, then the board.
      // The operator texted this same screenshot at 4:30 AM, which bounds when it was taken.
      {
        figure: {
          kind: 'image',
          src: '/figures/hiscores-overall-20261026',
          width: 634,
          height: 794,
          alt: 'The game’s Overall Hiscores table. Rank 1, cairnmax20x, level 1,881, time 3h 58m 34s. Rank 2, stunbaron, level 1,881, time 3h 59m 26s. Ranks 3 to 21 are other accounts at level 1,881, with times from 4h 01m 38s to 230h 39m 57s.',
          caption: 'The overall hiscores after the run.',
          source: 'The operator’s screenshot',
          takenBefore: '2026-10-26T11:30Z',
        },
        after: 'incredible work couldn’t have done it without you',
      },
      // The body among the spiders and the respawn the roster saw, after the quotation that paragraph introduces.
      { figure: { kind: 'clip', id: 'spider-death' }, after: 'Welp there goes the run' },
      // The death gap and the recovery, after the quotation the death beat ends on (its paragraph ends in a colon).
      { figure: { kind: 'timeline', crop: ['2026-10-26T03:00Z', '2026-10-26T11:30Z'] }, after: 'I WANT A #1' },
      // The kit the paragraph says was rebuilt overnight, arriving in the trade after the recovery login.
      { figure: { kind: 'clip', id: 'finish-rekit' }, after: 'Overnight the helpers rebuilt the lost kit' },
    ],
    pulled: ['Every tick counts'],
    links: [],
  },
];

export interface StorySection extends SectionMeta, DraftSection {
  /** The figures by the index of the block they follow. */
  figuresAt: ReadonlyMap<number, StoryFigure[]>;
  /** Pulled quotes by the index of the paragraph that quotes them, in reading order. */
  pulledAt: ReadonlyMap<number, string[]>;
}

const blockText = (b: StoryBlock) => (b.kind === 'p' ? b.text : b.paragraphs.join('\n\n'));

/** Whether the block quotes these words: inside double quotes in a paragraph, or anywhere in a quoted message. */
export const quotes = (b: StoryBlock, q: string) =>
  b.kind === 'p' ? b.text.includes(`"${q}"`) : b.paragraphs.some((p) => p.includes(q));

/** The draft's sections with what the page adds to them; fails loudly if the draft no longer supports an addition. */
export function storySections(story: Story): StorySection[] {
  if (story.sections.length !== SECTION_META.length) {
    throw new Error(`The draft has ${story.sections.length} sections; the page places ${SECTION_META.length}`);
  }
  return story.sections.map((d, i) => {
    const meta = SECTION_META[i]!;
    const where = `Section ${d.number}`;

    const figuresAt = new Map<number, StoryFigure[]>();
    for (const { figure, after } of meta.figures) {
      const hits = d.blocks.flatMap((b, j) => (blockText(b).includes(after) ? [j] : []));
      if (hits.length !== 1) throw new Error(`${where}: '${after}' is in ${hits.length} blocks, not one`);
      const at = hits[0]!;
      const anchor = d.blocks[at]!;
      // A paragraph ending in a colon introduces the quotation under it; a figure must not come between them.
      if (anchor.kind === 'p' && anchor.text.trimEnd().endsWith(':')) {
        throw new Error(`${where}: the figure would split '${after}' from the quotation it introduces`);
      }
      figuresAt.set(at, [...(figuresAt.get(at) ?? []), figure]);
    }

    const pulledAt = new Map<number, string[]>();
    for (const q of meta.pulled) {
      const at = d.blocks.findIndex((b) => quotes(b, q));
      if (at < 0) throw new Error(`${where}: the prose does not quote "${q}"`);
      pulledAt.set(at, [...(pulledAt.get(at) ?? []), q]);
    }
    for (const [at, qs] of pulledAt) {
      const text = blockText(d.blocks[at]!);
      qs.sort((a, b) => text.indexOf(a) - text.indexOf(b));
    }

    for (const l of meta.links) {
      if (!d.blocks.some((b) => b.kind === 'p' && b.text.includes(l.text))) throw new Error(`${where}: no prose says '${l.text}'`);
      if (!d.sources.some((s) => s.includes(l.href))) throw new Error(`${where}: ${l.href} is not in its sources`);
    }

    return { ...meta, ...d, figuresAt, pulledAt };
  });
}
