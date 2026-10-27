import { Component, type ReactNode } from 'react';

type Props = { fallback: ReactNode; children: ReactNode };

/**
 * Keeps a render error inside one part of a page, such as a replay's frame: that part shows
 * `fallback` and the rest of the page stays.
 */
export class Contained extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
