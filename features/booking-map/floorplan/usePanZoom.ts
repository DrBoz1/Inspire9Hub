import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface Transform { k: number; x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

/**
 * Keep the plan inside the frame.
 *
 * The group renders as `translate(x y) scale(k)`, so a plan point p lands at
 * x + p*k, and the visible frame is the viewBox itself. Zoomed in (k > 1) the
 * drawing is wider than the frame, so translation is free within the overhang
 * but neither edge may travel inside the frame -- that is what stops the plan
 * being dragged off into empty space. Zoomed out (k < 1) it is smaller than the
 * frame and there is nothing to choose: centre it.
 *
 * Only `k` was clamped before this; x and y were accumulated raw, which is why
 * the plan could be dragged anywhere.
 */
function clampPan(t: Transform, vb: Box): Transform {
  const loX = (vb.x + vb.w) * (1 - t.k);
  const hiX = vb.x * (1 - t.k);
  const loY = (vb.y + vb.h) * (1 - t.k);
  const hiY = vb.y * (1 - t.k);

  return {
    k: t.k,
    x: loX <= hiX ? Math.min(hiX, Math.max(loX, t.x)) : (vb.x + vb.w / 2) * (1 - t.k),
    y: loY <= hiY ? Math.min(hiY, Math.max(loY, t.y)) : (vb.y + vb.h / 2) * (1 - t.k),
  };
}



export interface PanZoomOptions {
  /** The SVG's viewBox — the transform is expressed in these units. */
  viewBox: Box;
  min?: number;
  max?: number;
  /** ms */
  duration?: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Pan/zoom over an SVG whose viewBox is fixed. `k === 1` is "fit to frame", so
 * zoom levels stay meaningful regardless of the container size.
 */
export function usePanZoom({ viewBox, min = 0.6, max = 14, duration = 480 }: PanZoomOptions) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [t, setT] = useState<Transform>(IDENTITY);
  const [isPanning, setPanning] = useState(false);

  const tRef = useRef(t);
  tRef.current = t;
  const raf = useRef<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const dragged = useRef(false);

  const stopAnim = useCallback(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }, []);

  const animateTo = useCallback(
    (target: Transform) => {
      stopAnim();
      if (prefersReducedMotion() || duration <= 0) {
        setT(target);
        return;
      }
      const from = tRef.current;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = easeOutCubic(p);
        setT({
          k: from.k + (target.k - from.k) * e,
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
        });
        if (p < 1) raf.current = requestAnimationFrame(step);
        else raf.current = null;
      };
      raf.current = requestAnimationFrame(step);
    },
    [duration, stopAnim],
  );

  useEffect(() => stopAnim, [stopAnim]);

  /** Screen point → viewBox units. */
  const toLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const clampK = useCallback((k: number) => Math.min(max, Math.max(min, k)), [min, max]);

  /** Zoom by `factor`, holding the point under (clientX, clientY) still. */
  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number, animate = false) => {
      stopAnim();
      const cur = tRef.current;
      const k = clampK(cur.k * factor);
      if (k === cur.k) return;
      const anchor =
        clientX !== undefined && clientY !== undefined
          ? toLocal(clientX, clientY)
          : { x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 };
      // anchor is already in transformed space; convert back to untransformed
      const ux = (anchor.x - cur.x) / cur.k;
      const uy = (anchor.y - cur.y) / cur.k;
      const next = { k, x: anchor.x - ux * k, y: anchor.y - uy * k };
      const bounded = clampPan(next, viewBox);
      if (animate) animateTo(bounded);
      else setT(bounded);
    },
    [animateTo, clampK, stopAnim, toLocal, viewBox],
  );

  const reset = useCallback(() => animateTo(IDENTITY), [animateTo]);

  /** Frame a region of the plan, with padding as a fraction of the region. */
  const focusOn = useCallback(
    (box: Box, pad = 0.55, maxK = 5) => {
      const bw = box.w * (1 + pad * 2);
      const bh = box.h * (1 + pad * 2);
      const k = clampK(Math.min(maxK, Math.min(viewBox.w / bw, viewBox.h / bh)));
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      animateTo({
        k,
        x: viewBox.x + viewBox.w / 2 - cx * k,
        y: viewBox.y + viewBox.h / 2 - cy * k,
      });
    },
    [animateTo, clampK, viewBox],
  );

  // ── pointer handling ───────────────────────────────────────────────────────

  /**
   * Pointer moves are tracked on `window`, not via `setPointerCapture` on the
   * SVG. Capturing on the SVG would retarget the subsequent `click` away from
   * the space the user pressed, which breaks selection; window listeners keep
   * the drag alive past the map's edge without stealing the click.
   */
  const onPointerMoveWin = useCallback(
    (e: PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 2 && gesture.current) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        if (gesture.current.dist > 0) zoomAt(dist / gesture.current.dist, cx, cy);
        gesture.current = { dist, cx, cy };
        dragged.current = true;
        return;
      }

      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragged.current = true;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // Convert screen delta → viewBox delta using the rendered scale.
      const s = Math.min(rect.width / viewBox.w, rect.height / viewBox.h) || 1;
      stopAnim();
      setT((cur) => clampPan({ ...cur, x: cur.x + dx / s, y: cur.y + dy / s }, viewBox));
    },
    [stopAnim, viewBox, zoomAt],
  );

  const onPointerUpWin = useCallback((e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) setPanning(false);
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    window.addEventListener('pointermove', onPointerMoveWin);
    window.addEventListener('pointerup', onPointerUpWin);
    window.addEventListener('pointercancel', onPointerUpWin);
    return () => {
      window.removeEventListener('pointermove', onPointerMoveWin);
      window.removeEventListener('pointerup', onPointerUpWin);
      window.removeEventListener('pointercancel', onPointerUpWin);
    };
  }, [isPanning, onPointerMoveWin, onPointerUpWin]);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    }
    setPanning(true);
  }, []);

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      // Trackpad pans horizontally/vertically; ctrl+wheel and mouse wheel zoom.
      const zoomIntent = e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 2;
      if (!zoomIntent) {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const s = Math.min(rect.width / viewBox.w, rect.height / viewBox.h) || 1;
        stopAnim();
        setT((cur) => clampPan({ ...cur, x: cur.x - e.deltaX / s, y: cur.y - e.deltaY / s }, viewBox));
        return;
      }
      const intensity = e.ctrlKey || e.metaKey ? 0.01 : 0.0022;
      zoomAt(Math.exp(-e.deltaY * intensity), e.clientX, e.clientY);
    },
    [stopAnim, viewBox, zoomAt],
  );

  // Wheel must be a non-passive native listener to allow preventDefault().
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const handlers = useMemo(() => ({ onPointerDown }), [onPointerDown]);

  return {
    svgRef,
    transform: t,
    /** True while a pointer is down — used to suppress hover chrome. */
    isPanning,
    /** True if the last pointer sequence moved far enough to count as a drag. */
    didDrag: () => dragged.current,
    handlers,
    zoomIn: () => zoomAt(1.45, undefined, undefined, true),
    zoomOut: () => zoomAt(1 / 1.45, undefined, undefined, true),
    reset,
    focusOn,
    setTransform: setT,
  };
}
