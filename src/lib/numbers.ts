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

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole dollars, '$17,679'. */
export const fmtUsd = (n: number) => dollars.format(n);
/** Dollars and cents, '$5.38'. */
export const fmtUsdCents = (n: number) => cents.format(n);
/** A fraction as whole percent, without the sign: 0.728 → '73'. */
export const fmtPercent = (f: number) => String(Math.round(f * 100));
/** 'a', 'a and b', 'a, b and c'. */
export const listWords = (xs: readonly string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
