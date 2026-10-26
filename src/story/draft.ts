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
 *   ## 1. Section title  paragraphs and '> ' block quotes (quoted messages)
 *   ...
 *   ## Receipts ...      one paragraph that introduces the receipts, then labels
 *                        each section's key anchors ('S1 ...', 'S2 ...'); any
 *                        paragraph after it belongs to the last section
 *
 * Each section's sources are its key anchors plus, where the narrator wrote one,
 * the source table from its dig file (data/receipts/section-N.md), put in plain
 * words for the page: the files keep their cairn:// addresses, the page does not.
 *
 * Inline markdown is limited to `code` spans and *emphasis*, which the page
 * renders; anything else is refused rather than shown to the reader as literal
 * brackets or asterisks.
 */

import { plainReceiptLines, plainSourceLines } from './sources';

export type StoryBlock = { kind: 'p'; text: string } | { kind: 'quote'; paragraphs: string[] };

export interface DraftSection {
  number: number;
  title: string;
  blocks: StoryBlock[];
  /** The section's receipts, then its dig table's sources, one per line, in plain words (src/story/sources.ts). */
  sources: string[];
}

export interface Story {
  title: string;
  byline: string;
  sections: DraftSection[];
}

export type InlineToken = { kind: 'text' | 'code' | 'em'; text: string };

/** A prose string as text, `code` and *emphasis* runs; throws on markup the page does not render. */
export function inlineTokens(s: string): InlineToken[] {
  const out: InlineToken[] = [];
  const re = /`([^`\n]+)`|\*([^*\s](?:[^*\n]*[^*\s])?)\*/g;
  let at = 0;
  for (const m of s.matchAll(re)) {
    if (m.index > at) out.push({ kind: 'text', text: s.slice(at, m.index) });
    out.push(m[1] !== undefined ? { kind: 'code', text: m[1] } : { kind: 'em', text: m[2]! });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ kind: 'text', text: s.slice(at) });
  for (const t of out) {
    if (t.kind !== 'text') continue;
    if (/[`*]|\]\(|^#|^\s*(?:[-+]|\d+\.)\s/m.test(t.text)) {
      throw new Error(`story.md: markdown the page would show literally: ${t.text.slice(0, 80)}`);
    }
  }
  return out;
}

interface Group {
  heading: string;
  blocks: StoryBlock[];
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
    } else if (l.trim() === '' || l === '---') flush();
    else buf.push(l);
  }
  flush();
  return out;
}

const blockText = (b: StoryBlock) => (b.kind === 'p' ? [b.text] : b.paragraphs);

/**
 * The source table in a dig file: from its first heading that names sources to the
 * next heading at the same level or above. Null when the file has none.
 */
export function sourceTable(dig: string): string | null {
  const lines = dig.split('\n');
  const start = lines.findIndex((l) => /^#{2,6} .*\bsources\b/i.test(l));
  if (start < 0) return null;
  const level = /^#+/.exec(lines[start]!)![0].length;
  const rest = lines.slice(start);
  const end = rest.findIndex((l, i) => i > 0 && /^#+ /.test(l) && /^#+/.exec(l)![0].length <= level);
  return rest.slice(0, end < 0 ? undefined : end).join('\n').trim();
}

/** The receipts paragraph's labelled parts: 'S1 ...', 'S2: ...', 'S4-S6 ...'. The introduction before 'S1' is not a source line. */
function labelledReceipts(text: string): { from: number; to: number; text: string }[] {
  const first = text.search(/(?:^| )S1[: ]/);
  if (first < 0) return [];
  const parts = text
    .slice(first)
    .trim()
    .split(/ (?=S\d(?:-S\d)?:? )/);
  let last = 0;
  return parts.map((part) => {
    const m = /^S(\d)(?:-S(\d))?:? /.exec(part);
    if (!m) throw new Error(`story.md: a receipt without a section label: ${part.slice(0, 60)}`);
    const from = Number(m[1]);
    const to = Number(m[2] ?? m[1]);
    if (from !== last + 1 || to < from) throw new Error(`story.md: receipt labels out of order at '${part.slice(0, 20)}'`);
    last = to;
    return { from, to, text: part };
  });
}

/** @param digs each section's dig file, by section number, where one exists */
export function parseStory(md: string, digs: Readonly<Record<number, string>> = {}): Story {
  if (md.includes('\r')) throw new Error('story.md: expected LF line endings');
  const lines = md.split('\n');
  const rule = lines.indexOf('---');
  if (rule < 0) throw new Error("story.md: expected a '---' rule under the reader line");

  const h1 = lines.slice(0, rule).filter((l) => l.startsWith('# '));
  if (h1.length !== 1) throw new Error('story.md: expected one title line above the first rule');
  const title = h1[0]!.slice(2);
  inlineTokens(title);

  const all = groups(lines.slice(rule + 1));
  const receiptsAt = all.findIndex((g) => g.heading.startsWith('Receipts'));
  if (receiptsAt !== all.length - 1) throw new Error('story.md: expected the Receipts section last');
  const [bylineGroup, ...rest] = all.slice(0, receiptsAt);
  const bylineBlock = bylineGroup?.blocks[0];
  if (bylineGroup?.heading !== 'Byline' || bylineGroup.blocks.length !== 1 || bylineBlock?.kind !== 'p') {
    throw new Error('story.md: expected a Byline section of one paragraph first');
  }
  const byline = bylineBlock.text;
  inlineTokens(byline);

  const sections: DraftSection[] = rest.map((g, i) => {
    const m = /^(\d+)\. (.+)$/.exec(g.heading);
    if (!m || Number(m[1]) !== i + 1) throw new Error(`story.md: expected section ${i + 1}, found '## ${g.heading}'`);
    if (!g.blocks.length) throw new Error(`story.md: section ${i + 1} has no prose`);
    g.blocks.flatMap(blockText).forEach(inlineTokens);
    inlineTokens(m[2]!);
    return { number: i + 1, title: m[2]!, blocks: g.blocks, sources: [] };
  });
  if (!sections.length) throw new Error('story.md: no sections');

  let labelled = false;
  for (const b of all[receiptsAt]!.blocks) {
    if (b.kind !== 'p') throw new Error('story.md: the Receipts hold paragraphs only');
    const parts = labelledReceipts(b.text);
    if (!parts.length) {
      if (labelled) sections.at(-1)!.sources.push(...plainReceiptLines(b.text));
      continue;
    }
    labelled = true;
    for (const p of parts) {
      for (let n = p.from; n <= p.to; n++) {
        const s = sections[n - 1];
        if (!s) throw new Error(`story.md: a receipt names section ${n}, which the draft lacks`);
        s.sources.push(...plainReceiptLines(p.text));
      }
    }
  }
  for (const [n, dig] of Object.entries(digs)) {
    const s = sections[Number(n) - 1];
    if (!s) throw new Error(`receipts: a dig file for section ${n}, which the draft lacks`);
    const table = sourceTable(dig);
    if (table) s.sources.push(...plainSourceLines(table));
  }
  const bare = sections.find((s) => !s.sources.length);
  if (bare) throw new Error(`story.md: section ${bare.number} has no receipts`);

  return { title, byline, sections };
}
