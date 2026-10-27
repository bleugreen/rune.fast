import raw from '../../data/figures.json';
import { WORLD_ASSET_BASE } from '../replay/assets';

/** One published size and format of a figure, named by its key under the world assets. */
export interface Rendition {
  /** `column`: what the page draws; `full`: the source's own pixels, opened to read the text. */
  use: 'column' | 'full';
  type: 'image/avif' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  /** `figures/<id>.<width>.<sha8>.<ext>`: the name carries the content, so the object is immutable. */
  src: string;
  bytes: number;
}

/** A rectangle of the source, in its pixels, blocked out before anything is published. */
export interface Mask {
  x: number;
  y: number;
  width: number;
  height: number;
  what: string;
}

/**
 * A still too large for git (README, "Figures"): its source image by content, what was masked out
 * of it, and the renditions scripts/figures/publish-figures.ts made from it.
 */
export interface FigureEntry {
  id: string;
  alt: string;
  source: { file: string; sha256: string; width: number; height: number };
  masks: Mask[];
  renditions: Rendition[];
}

export const FIGURES: readonly FigureEntry[] = raw as unknown as FigureEntry[];

export function figureById(id: string): FigureEntry {
  const f = FIGURES.find((x) => x.id === id);
  if (!f) throw new Error(`no figure registered as ${id}`);
  return f;
}

export function rendition(f: FigureEntry, use: Rendition['use'], type?: Rendition['type']): Rendition {
  const r = f.renditions.find((x) => x.use === use && (!type || x.type === type));
  if (!r) throw new Error(`${f.id} has no ${use} rendition${type ? ` as ${type}` : ''}`);
  return r;
}

/** Where the page fetches a rendition: its key under the world assets. */
export const figureSrc = (r: Rendition) => `${WORLD_ASSET_BASE}${r.src}`;
