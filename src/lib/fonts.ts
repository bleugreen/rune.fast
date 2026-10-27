const ITALIC = '/fonts/RuneSerif-Italic.var.woff2';

let registered = false;

/**
 * The serif's italic, registered from script rather than in base.css. A face declared in CSS is
 * fetched as soon as any text in the document needs it, and the story page's prose, all of it
 * below the first screen, has italics from the start; its first screen (the tree, the title and
 * the byline) has none. So the story page registers it once that screen is drawn, and every other
 * page, whose first screen may set italic, at once (Layout). Until it is in, italic text falls
 * back as it does under font-display: swap.
 */
export function registerItalic(): void {
  if (registered || typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  registered = true;
  const face = new FontFace('Rune Serif', `url('${ITALIC}') format('woff2-variations'), url('${ITALIC}') format('woff2')`, {
    style: 'italic',
    weight: '200 900',
    display: 'swap',
  });
  document.fonts.add(face);
}
