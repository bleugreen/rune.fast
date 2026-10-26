/**
 * The narrator's draft (data/story.md) split into what the story page sets.
 *
 * The draft is placed verbatim (RUNE tenet #1): this module only splits it and
 * never edits a character. Its layout:
 *
 *   # Title
 *   <reader line: an editorial note, not page copy>
 *   ---
 *   ## Byline            one paragraph
 *   ## 1. Section title  paragraphs and '> ' block quotes
 *   ...
 *   ---
 *   ## Receipts ...      'S1: ... S2: ... S4-S6: ...' lines for each section's
 *                        sources; an unlabelled paragraph belongs to the last section
 *
 * Markdown beyond headings, paragraphs and block quotes is refused rather than
 * shown to the reader as literal asterisks or brackets.
 */

export type StoryBlock = { kind: 'p'; text: string } | { kind: 'quote'; paragraphs: string[] };

export interface DraftSection {
  number: number;
  title: string;
  blocks: StoryBlock[];
  /** The section's lines from the Receipts, verbatim, label included. */
  sources: string[];
}

export interface Story {
  title: string;
  byline: string;
  sections: DraftSection[];
}

interface Group {
  heading: string;
  blocks: StoryBlock[];
}

const MARKUP = /[*_`[\]]|^#|^\s*(?:[-+]|\d+\.)\s/m;

function plain(text: string, where: string): string {
  if (MARKUP.test(text)) throw new Error(`story.md: ${where} holds markdown the page would show literally: ${text.slice(0, 80)}`);
  return text;
}

function block(lines: string[]): StoryBlock {
  const quoted = lines.filter((l) => l.startsWith('>')).length;
  if (!quoted) return { kind: 'p', text: lines.join('\n') };
  if (quoted !== lines.length) throw new Error(`story.md: a block mixes quoted and unquoted lines: ${lines[0]}`);
  const paragraphs: string[] = [];
  let para: string[] = [];
  for (const l of lines.map((x) => x.replace(/^> ?/, ''))) {
    if (l.trim() === '') {
      if (para.length) paragraphs.push(para.join('\n'));
      para = [];
    } else para.push(l);
  }
  if (para.length) paragraphs.push(para.join('\n'));
  return { kind: 'quote', paragraphs };
}

function groups(lines: string[]): Group[] {
  const out: Group[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    const g = out.at(-1);
    if (!g) throw new Error(`story.md: text before the first heading: ${buf[0]}`);
    g.blocks.push(block(buf));
    buf = [];
  };
  for (const l of lines) {
    if (l.startsWith('## ')) {
      flush();
      out.push({ heading: l.slice(3), blocks: [] });
    } else if (l.trim() === '') flush();
    else buf.push(l);
  }
  flush();
  return out;
}

const blockText = (b: StoryBlock) => (b.kind === 'p' ? [b.text] : b.paragraphs);

export function parseStory(md: string): Story {
  if (md.includes('\r')) throw new Error('story.md: expected LF line endings');
  const lines = md.split('\n');
  const rules = lines.flatMap((l, i) => (l === '---' ? [i] : []));
  if (rules.length !== 2) throw new Error(`story.md: expected two '---' rules, found ${rules.length}`);
  const [r0, r1] = rules as [number, number];

  const h1 = lines.slice(0, r0).filter((l) => l.startsWith('# '));
  if (h1.length !== 1) throw new Error('story.md: expected one title line above the first rule');
  const title = plain(h1[0]!.slice(2), 'the title');

  const [bylineGroup, ...rest] = groups(lines.slice(r0 + 1, r1));
  const bylineBlock = bylineGroup?.blocks[0];
  if (bylineGroup?.heading !== 'Byline' || bylineGroup.blocks.length !== 1 || bylineBlock?.kind !== 'p') {
    throw new Error('story.md: expected a Byline section of one paragraph first');
  }
  const byline = plain(bylineBlock.text, 'the byline');

  const sections: DraftSection[] = rest.map((g, i) => {
    const m = /^(\d+)\. (.+)$/.exec(g.heading);
    if (!m || Number(m[1]) !== i + 1) throw new Error(`story.md: expected section ${i + 1}, found '## ${g.heading}'`);
    if (!g.blocks.length) throw new Error(`story.md: section ${i + 1} has no prose`);
    g.blocks.flatMap(blockText).forEach((t) => plain(t, `section ${i + 1}`));
    return { number: i + 1, title: plain(m[2]!, `section ${i + 1}'s title`), blocks: g.blocks, sources: [] };
  });
  if (!sections.length) throw new Error('story.md: no sections');

  const receipts = groups(lines.slice(r1 + 1));
  if (receipts.length !== 1 || !receipts[0]!.heading.startsWith('Receipts')) {
    throw new Error('story.md: expected one Receipts section after the second rule');
  }
  for (const b of receipts[0]!.blocks) {
    if (b.kind !== 'p') throw new Error('story.md: the Receipts hold paragraphs only');
    if (!/^S\d/.test(b.text)) {
      sections.at(-1)!.sources.push(b.text);
      continue;
    }
    for (const part of b.text.split(/ (?=S\d(?:-S\d)?: )/)) {
      const m = /^S(\d)(?:-S(\d))?: /.exec(part);
      if (!m) throw new Error(`story.md: a receipt without a section label: ${part.slice(0, 60)}`);
      for (let n = Number(m[1]); n <= Number(m[2] ?? m[1]); n++) {
        const s = sections[n - 1];
        if (!s) throw new Error(`story.md: a receipt names section ${n}, which the draft lacks`);
        s.sources.push(part);
      }
    }
  }
  const bare = sections.find((s) => !s.sources.length);
  if (bare) throw new Error(`story.md: section ${bare.number} has no receipts`);

  return { title, byline, sections };
}
