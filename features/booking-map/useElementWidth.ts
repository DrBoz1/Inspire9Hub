'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The rendered width of an element, kept current with ResizeObserver.
 *
 * Null until the first measurement, so callers can hold off rendering width-
 * dependent layout rather than flash the wrong one. useLayoutEffect measures before
 * the browser paints; the map is client-only (next/dynamic, ssr: false), so there's
 * no server render for it to warn about.
 *
 * Rounded to whole pixels: sub-pixel jitter during a resize would otherwise re-run
 * every layout calculation for no visible change.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}
