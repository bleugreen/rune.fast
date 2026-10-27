import { Fragment } from 'react';
import { markThreads } from '../lib/threads';

/** A line of text with its backticked spans set as code. */
export function Coded({ text }: { text: string }) {
  return (
    <>
      {text.split(/`([^`]+)`/).map((part, k) => (k % 2 ? <code key={k}>{part}</code> : <Fragment key={k}>{part}</Fragment>))}
    </>
  );
}

/** A generated line (a source, a figure's caption) with the run's thread names set as code. */
export function Threaded({ text }: { text: string }) {
  return <Coded text={markThreads(text)} />;
}
