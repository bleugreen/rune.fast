import { useLayoutEffect, useState, type RefCallback } from 'react';

/** Observed content width of an element, in CSS pixels (0 until first measured). */
export function useWidth<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}
