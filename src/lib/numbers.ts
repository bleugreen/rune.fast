const grouped = new Intl.NumberFormat('en-US');

export const fmtInt = (n: number) => grouped.format(n);

const CARDINALS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

/** Small counts as words, larger ones as figures (newspaper style). */
export const countWord = (n: number) => CARDINALS[n] ?? fmtInt(n);
export const timesWord = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${countWord(n)} times`);
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
