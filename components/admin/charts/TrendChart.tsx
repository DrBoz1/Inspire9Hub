"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { TREND_VIEWBOX } from "./trend-geometry";

/** A point already placed by the server: x and y are percentages of the plot. */
export type TrendPoint = { label: string; display: string; x: number; y: number };
export type TrendTick = { label: string; y: number };

/**
 * One series over time: a 2px line, a faint wash beneath it, and a crosshair
 * that snaps to the nearest point on hover. The same readout is reachable from
 * the keyboard (arrow keys, Home, End), and every value is also in the table
 * view beside the chart, so nothing here is hover-only.
 */
export function TrendChart({ label, points, ticks, line, area }: { label: string; points: TrendPoint[]; ticks: TrendTick[]; line: string; area: string }) {
  const [active, setActive] = useState<number | null>(null);
  const readoutId = useId();
  const last = points.length - 1;
  const end = points[last];
  const shown = active === null ? null : points[active];

  function nearest(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || last < 0) return;
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setActive(last === 0 ? 0 : Math.round(fraction * last));
  }

  function step(event: KeyboardEvent<HTMLDivElement>) {
    if (last < 0) return;
    const at = active ?? last;
    const next = event.key === "ArrowLeft" ? at - 1 : event.key === "ArrowRight" ? at + 1 : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    setActive(Math.min(last, Math.max(0, next)));
  }

  // Three x labels (start, middle, end) are enough to anchor the dates without colliding.
  const xLabels = last < 1 ? points : [points[0], points[Math.floor(last / 2)], points[last]];

  return (
    <figure className="admin-trend">
      <div className="admin-trend-body">
        <div className="admin-trend-axis" aria-hidden>
          {ticks.map((t) => (
            <span key={t.label} style={{ top: `${t.y}%` }}>{t.label}</span>
          ))}
        </div>
        <div
          className="admin-trend-plot"
          tabIndex={0}
          role="group"
          aria-label={`${label}. Use the left and right arrow keys to read each point.`}
          aria-describedby={readoutId}
          onPointerMove={nearest}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((a) => a ?? last)}
          onBlur={() => setActive(null)}
          onKeyDown={step}
        >
          {ticks.map((t) => (
            <i key={t.label} className="admin-trend-grid" style={{ top: `${t.y}%` }} aria-hidden />
          ))}
          <svg viewBox={`0 0 ${TREND_VIEWBOX.width} ${TREND_VIEWBOX.height}`} preserveAspectRatio="none" aria-hidden>
            <path d={area} className="admin-trend-area" />
            <path d={line} className="admin-trend-line" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Dots are HTML, not SVG: the SVG stretches to the plot, which would squash a circle into an oval. */}
          {end && <i className="admin-trend-dot" style={{ left: `${end.x}%`, top: `${end.y}%` }} aria-hidden />}
          {shown && (
            <>
              <i className="admin-trend-cross" style={{ left: `${shown.x}%` }} aria-hidden />
              <i className="admin-trend-dot" data-active style={{ left: `${shown.x}%`, top: `${shown.y}%` }} aria-hidden />
              <div className="admin-trend-tip" data-side={shown.x > 62 ? "left" : "right"} style={{ left: `${shown.x}%` }} aria-hidden>
                <strong>{shown.display}</strong>
                <span>{shown.label}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="admin-trend-x" aria-hidden>
        {xLabels.map((p, i) => (
          <span key={`${p.label}-${i}`} style={{ left: `${p.x}%` }} data-edge={i === 0 ? "start" : i === xLabels.length - 1 && xLabels.length > 1 ? "end" : undefined}>
            {p.label}
          </span>
        ))}
      </div>
      <p id={readoutId} className="sr-only" aria-live="polite">
        {shown ? `${shown.label}: ${shown.display}` : ""}
      </p>
    </figure>
  );
}
