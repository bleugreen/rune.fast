/**
 * The rs run's six threads, by the names the run gave them. The site writes a thread's name as code
 * wherever it stands as a name, as the story's draft does: in prose by hand, in SVG labels in the
 * mono face, and in generated lines (sources, figure captions) through `markThreads`.
 */
export const THREADS = ['main', 'integration', 'host', 'markets', 'document', 'autoresearch'] as const;

/**
 * A thread's name standing as a name: not part of an address, a file name or a hyphenated word
 * ('rs/main', 'main.ts', 'run-host'), and not 'host' in its everyday sense, the machine the run
 * played from ('the run host').
 */
const NAME = new RegExp(String.raw`(?<![\w/.-])(?<!\brun )(?:${THREADS.join('|')})(?![\w/-]|\.\w)`, 'gi');
/** Quoted words, which stay as they were said, and code already marked. */
const KEPT = /“[^”]*”|"[^"]*"|`[^`]*`/g;

const mark = (s: string) => s.replace(NAME, (name) => `\`${name.toLowerCase()}\``);

/** A generated line with each thread name in it marked as code (`main`), outside quoted words. */
export function markThreads(s: string): string {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(KEPT)) {
    out += mark(s.slice(last, m.index)) + m[0];
    last = m.index! + m[0].length;
  }
  return out + mark(s.slice(last));
}
