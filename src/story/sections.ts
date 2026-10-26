import type { DraftSection, Story, StoryBlock } from './draft';

/** The one figure each section carries. */
export type StoryFigure =
  /** The record against this run, in ticks. */
  | { kind: 'ladder' }
  /** A 10-15 s lab clip; until one is placed here, a slot that links to the tricks page. */
  | { kind: 'clip' }
  /** The cost page's day chart, linked. */
  | { kind: 'cost' }
  /** The attempts chart, cropped to the section's hours (UTC). */
  | { kind: 'timeline'; crop: readonly [string, string] };

interface SectionMeta {
  /** The section's anchor on the page. */
  id: string;
  /** From the story spine; the draft does not date its sections. */
  dates: string;
  figure: StoryFigure;
  /** The figure follows the one block of prose that contains this text. */
  figureAfter: string;
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
    figure: { kind: 'ladder' },
    figureAfter: 'The number that never moved was 35,916 ticks',
    pulled: ['sounds like a plan', 'Sure!', 'absolutely! Swarm out my guy :)'],
    links: [{ text: 'RuneScape Bench: MMOs for Agents', href: 'https://www.youtube.com/watch?v=cNm4zyUtWj0' }],
  },
  {
    id: 'the-tricks',
    dates: '20–22 Oct',
    figure: { kind: 'clip' },
    figureAfter: 'Five minutes later main had the wine script open',
    pulled: [],
    links: [],
  },
  {
    id: 'the-swarm',
    dates: '21–22 Oct',
    figure: { kind: 'cost' },
    figureAfter: 'The day cost $5,448',
    pulled: [],
    links: [],
  },
  {
    id: 'four-attempts',
    dates: '23–24 Oct',
    figure: { kind: 'timeline', crop: ['2026-10-23T17:00Z', '2026-10-24T17:00Z'] },
    figureAfter: 'ok fine one more attempt',
    pulled: ['ok fine one more attempt'],
    links: [],
  },
  {
    id: 'twenty-eight-hours',
    dates: '25–26 Oct',
    figure: { kind: 'timeline', crop: ['2026-10-25T06:00Z', '2026-10-25T22:00Z'] },
    figureAfter: 'Attempt 5 logged in',
    pulled: ['wall clock is free, ticks are not'],
    links: [],
  },
  {
    id: 'the-death',
    dates: '26 Oct',
    figure: { kind: 'timeline', crop: ['2026-10-26T03:00Z', '2026-10-26T11:30Z'] },
    figureAfter: 'incredible work couldnt have done it without you',
    pulled: ['Every tick counts'],
    links: [],
  },
];

export interface StorySection extends SectionMeta, DraftSection {
  /** The block the figure follows. */
  figureIndex: number;
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

    const hits = d.blocks.flatMap((b, j) => (blockText(b).includes(meta.figureAfter) ? [j] : []));
    if (hits.length !== 1) throw new Error(`${where}: '${meta.figureAfter}' is in ${hits.length} blocks, not one`);
    const anchor = d.blocks[hits[0]!]!;
    // A paragraph ending in a colon introduces the quotation under it; a figure must not come between them.
    if (anchor.kind === 'p' && anchor.text.trimEnd().endsWith(':')) {
      throw new Error(`${where}: the figure would split '${meta.figureAfter}' from the quotation it introduces`);
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

    return { ...meta, ...d, figureIndex: hits[0]!, pulledAt };
  });
}
