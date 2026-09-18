"use client";

import { useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";

/** A cell already described by the server. Level 0 is open but empty; 1-4 step up the ramp. */
export type HeatmapCell = { state: "open" | "closed" | "none"; level: 0 | 1 | 2 | 3 | 4; text: string };
export type HeatmapRow = { label: string; cells: HeatmapCell[] };

type Tip = { text: string; left: number; top: number; side: "start" | "middle" | "end" };

/**
 * Weekday x hour grid. One tab stop for the whole grid (the ARIA grid pattern):
 * arrow keys move between cells, Home and End jump along a row, and hovering or
 * focusing a cell shows the same readout. Every value is also in the table view.
 */
export function Heatmap({ label, hours, rows }: { label: string; hours: string[]; rows: HeatmapRow[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLDivElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const columns = hours.length;

  function show(index: number, element: HTMLElement) {
    const box = wrap.current?.getBoundingClientRect();
    const cell = element.getBoundingClientRect();
    const r = Math.floor(index / columns);
    const text = rows[r]?.cells[index % columns]?.text;
    if (!box || !text) return;
    const left = cell.left - box.left + cell.width / 2;
    // Keep the readout inside the panel near either edge, rather than centring it off-screen.
    const side = left < 90 ? "start" : left > box.width - 90 ? "end" : "middle";
    setTip({ text, left, top: cell.top - box.top, side });
  }

  function move(event: KeyboardEvent<HTMLDivElement>, index: number) {
    const r = Math.floor(index / columns);
    const c = index % columns;
    const target =
      event.key === "ArrowRight" ? [r, c + 1]
      : event.key === "ArrowLeft" ? [r, c - 1]
      : event.key === "ArrowDown" ? [r + 1, c]
      : event.key === "ArrowUp" ? [r - 1, c]
      : event.key === "Home" ? [r, 0]
      : event.key === "End" ? [r, columns - 1]
      : null;
    if (!target) return;
    event.preventDefault();
    const [nr, nc] = target;
    if (nr < 0 || nr >= rows.length || nc < 0 || nc >= columns) return;
    const next = nr * columns + nc;
    setFocus(next);
    cells.current[next]?.focus();
  }

  return (
    <div className="admin-heat" ref={wrap}>
      <div className="admin-heat-grid" role="grid" aria-label={label} style={{ gridTemplateColumns: `2.6em repeat(${columns}, minmax(0, 1fr))` }}>
        <div role="row" className="admin-heat-row">
          <span role="columnheader" className="admin-heat-corner"><span className="sr-only">Day</span></span>
          {hours.map((hour, c) => (
            <span key={hour} role="columnheader" className="admin-heat-hour">
              {/* Every third hour is labelled; the rest stay readable to screen readers. */}
              {c % 3 === 0 ? hour : <span className="sr-only">{hour}</span>}
            </span>
          ))}
        </div>
        {rows.map((row, r) => (
          <div key={row.label} role="row" className="admin-heat-row">
            <span role="rowheader" className="admin-heat-day">{row.label}</span>
            {row.cells.map((cell, c) => {
              const index = r * columns + c;
              return (
                <div
                  key={c}
                  ref={(el) => { cells.current[index] = el; }}
                  role="gridcell"
                  tabIndex={index === focus ? 0 : -1}
                  aria-label={cell.text}
                  className="admin-heat-cell"
                  data-state={cell.state}
                  data-level={cell.state === "open" ? cell.level : undefined}
                  onPointerEnter={(e: PointerEvent<HTMLDivElement>) => show(index, e.currentTarget)}
                  onPointerLeave={() => setTip(null)}
                  onFocus={(e: FocusEvent<HTMLDivElement>) => { setFocus(index); show(index, e.currentTarget); }}
                  onBlur={() => setTip(null)}
                  onKeyDown={(e) => move(e, index)}
                />
              );
            })}
          </div>
        ))}
      </div>
      {tip && (
        <div className="admin-heat-tip" data-side={tip.side} style={{ left: tip.left, top: tip.top }} aria-hidden>
          {tip.text}
        </div>
      )}
      <div className="admin-heat-legend" aria-hidden>
        <span>Quiet</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i key={level} className="admin-heat-cell" data-state="open" data-level={level} />
        ))}
        <span>Busy</span>
        <i className="admin-heat-cell" data-state="closed" />
        <span>Closed</span>
      </div>
    </div>
  );
}
