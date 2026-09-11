import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Availability, Space } from '../booking/types';
import { PLAN_VIEWBOX } from './plan';
import { PlanBase, PlanInk } from './PlanBase';
import { bbox, centroid, nearestInDirection, pathFor, readingOrder } from './shapes';
import { usePanZoom } from './usePanZoom';
import { PlanLabels } from './PlanLabels';

const VB = PLAN_VIEWBOX;

export interface FloorPlanProps {
  spaces: Space[];
  status: Map<string, Availability>;
  /** Spaces that survive the current filters. Others render dimmed and inert. */
  visible: Set<string>;
  selectedId: string | null;
  hoveredId: string | null;
  /** Sub-line copy per space, e.g. "Free from 1pm". */
  subline: Map<string, string>;
  ariaLabels: Map<string, string>;
  mapLabel: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** Imperative handle so the sidebar and toolbar can drive the camera. */
  cameraRef?: React.MutableRefObject<Camera | null>;
}

export interface Camera {
  focus: (id: string) => void;
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export function FloorPlan({
  spaces, status, visible, selectedId, hoveredId, subline, ariaLabels, mapLabel,
  onSelect, onHover, cameraRef,
}: FloorPlanProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [focusId, setFocusId] = useState<string | null>(null);
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  const { svgRef, transform, isPanning, didDrag, handlers, zoomIn, zoomOut, reset, focusOn } =
    usePanZoom({ viewBox: VB, min: 1, max: 6 });

  // ── container measurement drives label placement + pattern scale ──────────
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** px per viewBox unit at the current container size (preserveAspectRatio meet). */
  const renderScale = Math.min(size.w / VB.w, size.h / VB.h) || 0.001;
  const k = transform.k;
  /** Scale that keeps a pattern tile / label a constant number of screen px. */
  const invScale = 1 / (k * renderScale);

  const bookable = useMemo(() => spaces.filter((s) => s.bookable), [spaces]);
  // Unlinked spaces can't be booked but can still be opened.
  const selectable = useMemo(() => spaces.filter((s) => s.bookable || s.unlinked), [spaces]);
  const ordered = useMemo(() => readingOrder(selectable), [selectable]);
  const navigable = useMemo(
    () => ordered.filter((s) => visible.has(s.id)),
    [ordered, visible],
  );

  const rovingId = useMemo(() => {
    if (focusId && visible.has(focusId)) return focusId;
    if (selectedId && visible.has(selectedId)) return selectedId;
    return navigable[0]?.id ?? null;
  }, [focusId, navigable, selectedId, visible]);

  const focusSpace = useCallback(
    (id: string, pan = true) => {
      setFocusId(id);
      const node = svgRef.current?.querySelector<SVGGElement>(`[data-space="${CSS.escape(id)}"]`);
      node?.focus({ preventScroll: true });
      const sp = spaces.find((s) => s.id === id);
      if (pan && sp) {
        const b = bbox(sp.shape);
        const [cx, cy] = centroid(sp.shape);
        const ox = (size.w - VB.w * renderScale) / 2;
        const oy = (size.h - VB.h * renderScale) / 2;
        const sx = ox + (cx * k + transform.x - VB.x) * renderScale;
        const sy = oy + (cy * k + transform.y - VB.y) * renderScale;
        const off = 48;
        if (sx < off || sy < off || sx > size.w - off || sy > size.h - off) focusOn(b, 1.2, k);
      }
    },
    [focusOn, k, renderScale, size.h, size.w, spaces, svgRef, transform.x, transform.y],
  );

  useEffect(() => {
    if (!cameraRef) return;
    cameraRef.current = {
      focus: (id: string) => {
        const sp = spaces.find((s) => s.id === id);
        if (sp) focusOn(bbox(sp.shape), 0.55, 4);
      },
      fit: reset,
      zoomIn,
      zoomOut,
    };
    return () => {
      cameraRef.current = null;
    };
  }, [cameraRef, focusOn, reset, spaces, zoomIn, zoomOut]);

  // ── keyboard model (§7.3) ─────────────────────────────────────────────────
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const dirs: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      };
      if (e.key in dirs) {
        e.preventDefault();
        setKeyboardFocus(true);
        const cur = rovingId ? spaces.find((s) => s.id === rovingId) : null;
        const from = cur ? centroid(cur.shape) : ([VB.x + VB.w / 2, VB.y + VB.h / 2] as [number, number]);
        const next = nearestInDirection(
          from,
          dirs[e.key],
          navigable.filter((s) => s.id !== rovingId).map((s) => ({ id: s.id, at: centroid(s.shape) })),
        );
        if (next) focusSpace(next);
        return;
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        setKeyboardFocus(true);
        const t = e.key === 'Home' ? navigable[0] : navigable[navigable.length - 1];
        if (t) focusSpace(t.id);
        return;
      }
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault();
        setKeyboardFocus(true);
        const kinds = [...new Set(navigable.map((s) => s.kind))];
        const cur = navigable.find((s) => s.id === rovingId);
        const i = cur ? kinds.indexOf(cur.kind) : 0;
        const nextKind = kinds[(i + (e.key === 'PageDown' ? 1 : -1) + kinds.length) % kinds.length];
        const t = navigable.find((s) => s.kind === nextKind);
        if (t) focusSpace(t.id);
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && rovingId) {
        e.preventDefault();
        onSelect(rovingId);
        return;
      }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); reset(); }
    },
    [focusSpace, navigable, onSelect, reset, rovingId, spaces, zoomIn, zoomOut],
  );

  const handleClick = useCallback(
    (id: string) => {
      if (didDrag()) return;
      setKeyboardFocus(false);
      setFocusId(id);
      onSelect(id);
    },
    [didDrag, onSelect],
  );

  // Furniture fades in between fit-to-view and ~1.3× (§5.3).
  const furnitureOpacity = Math.max(0.5, Math.min(1, 0.5 + (k - 1) * 1.6));

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      role="application"
      aria-roledescription="interactive floor plan"
      aria-label={mapLabel}
      aria-describedby="fp-help"
      tabIndex={-1}
    >
      <p id="fp-help" className="sr-only">
        Use the arrow keys to move between spaces. Press Enter to open a space and book it. Press
        plus or minus to zoom and zero to fit the plan to the screen.
      </p>

      <svg
        ref={svgRef}
        className="fp-svg"
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        preserveAspectRatio="xMidYMid meet"
        data-panning={isPanning}
        onKeyDown={onKeyDown}
        {...handlers}
      >
        <defs>
          {/* Hatch tiles are an accessibility carrier, so they hold a constant
              screen size rather than scaling with the drawing (§5.3). */}
          <pattern
            id="fp-hatch-partial" patternUnits="userSpaceOnUse" width={6} height={6}
            patternTransform={`scale(${invScale})`}
          >
            <path
              d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2"
              stroke="var(--color-status-partial)" strokeWidth={1} strokeOpacity={0.45}
            />
          </pattern>
          <pattern
            id="fp-hatch-full" patternUnits="userSpaceOnUse" width={6} height={6}
            patternTransform={`scale(${invScale})`}
          >
            <path
              d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2 M-1,5 l2,2 M0,0 l6,6 M5,-1 l2,2"
              stroke="var(--color-status-full)" strokeWidth={1} strokeOpacity={0.4}
            />
          </pattern>
        </defs>

        <g transform={`translate(${transform.x} ${transform.y}) scale(${k})`}>
          <PlanBase />

          {/* ── #status: availability wash, UNDER the ink ─────────────────── */}
          <g>
            {bookable.map((s) => {
              if (!visible.has(s.id)) return null;
              const st = status.get(s.id) ?? 'unknown';
              const hovered = hoveredId === s.id;
              const selected = selectedId === s.id;
              return (
                <g key={`st-${s.id}`}>
                  <path
                    className={`fp-status fp-status-${st}`}
                    data-hovered={hovered}
                    data-selected={selected}
                    d={pathFor(s.shape, 3)}
                  />
                  {(st === 'partial' || st === 'booked') && (
                    <path
                      d={pathFor(s.shape, 3)}
                      fill={`url(#fp-hatch-${st === 'partial' ? 'partial' : 'full'})`}
                      stroke="none"
                    />
                  )}
                </g>
              );
            })}
          </g>

          <PlanInk furnitureOpacity={furnitureOpacity} />

          {/* Filtered-out spaces recede behind a paper scrim rather than losing
              contrast — the linework stays intact underneath. */}
          <g>
            {spaces.map((s) =>
              visible.has(s.id) ? null : (
                <path key={`sc-${s.id}`} className="fp-scrim" d={pathFor(s.shape, 2)} />
              ),
            )}
          </g>

          {/* ── #interact + #hit ───────────────────────────────────────────── */}
          <g role="group" aria-label="Bookable spaces">
            {spaces.map((s) => {
              const isVisible = visible.has(s.id);
              const canSelect = s.bookable || !!s.unlinked;
              const st = s.bookable ? status.get(s.id) ?? 'unknown' : 'closed';
              const selected = selectedId === s.id;
              const hovered = hoveredId === s.id;
              const focused = keyboardFocus && rovingId === s.id;
              const d = pathFor(s.shape, 6);
              return (
                <g
                  key={`in-${s.id}`}
                  className="fp-space"
                  data-space={s.id}
                  data-bookable={s.bookable}
                  data-hovered={hovered}
                  data-selected={selected}
                  role={canSelect ? 'button' : 'img'}
                  aria-label={ariaLabels.get(s.id) ?? s.name}
                  aria-pressed={canSelect ? selected : undefined}
                  aria-disabled={!isVisible || undefined}
                  tabIndex={canSelect && isVisible && rovingId === s.id ? 0 : -1}
                  onFocus={() => setFocusId(s.id)}
                  onPointerEnter={() => isVisible && onHover(s.id)}
                  onPointerLeave={() => onHover(null)}
                  onClick={() => isVisible && canSelect && handleClick(s.id)}
                  style={{ outline: 'none', display: isVisible ? undefined : 'none' }}
                >
                  {selected && <path className="fp-halo" d={d} />}
                  <path className={`fp-outline fp-outline-${st}`} d={d} />
                  {st === 'mine' && <path className="fp-mine-inner" d={pathFor(s.shape, 14)} />}
                  {focused && (
                    <>
                      <path className="fp-focus-ring-inner" d={pathFor(s.shape, 1)} />
                      <path className="fp-focus-ring-outer" d={pathFor(s.shape, -2)} />
                    </>
                  )}
                  {/* Transparent stroke grows the target by 6 px on every edge. */}
                  <path
                    className="fp-hit"
                    d={d}
                    stroke="transparent"
                    strokeWidth={12}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents={isVisible && canSelect ? 'all' : 'none'}
                  />
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <PlanLabels
        spaces={spaces}
        status={status}
        visible={visible}
        selectedId={selectedId}
        hoveredId={hoveredId}
        subline={subline}
        transform={transform}
        renderScale={renderScale}
        viewBox={VB}
        size={size}
      />
    </div>
  );
}
