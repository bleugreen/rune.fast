const grouped = new Intl.NumberFormat('en-US');

export const fmtInt = (n: number) => grouped.format(n);

/** '35,916' -> 35916 */
export const parseGrouped = (s: string) => Number(s.replace(/,/g, ''));

const CARDINALS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

/** Small counts as words, larger ones as figures (newspaper style). */
export const countWord = (n: number) => CARDINALS[n] ?? fmtInt(n);
export const ordinalWord = (n: number) => ORDINALS[n] ?? `${fmtInt(n)}th`;
export const timesWord = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${countWord(n)} times`);
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
