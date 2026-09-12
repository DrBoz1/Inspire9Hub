import React from 'react';

/**
 * Furniture primitives drawn in the language of the source floor plan:
 * hairline outlines, no fills heavier than a wash, square corners except where
 * the drawing rounds them.
 */

export const Desk: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => (
  <g className="fp-furniture">
    <rect x={x} y={y} width={w} height={h} />
    <line x1={x} y1={y + h * 0.62} x2={x + w} y2={y + h * 0.62} />
  </g>
);

/** Chair seen from above: seat + back, oriented by `rot` degrees (0 = back to north). */
export const Chair: React.FC<{ cx: number; cy: number; r?: number; rot?: number; tone?: string }> = ({
  cx, cy, r = 15, rot = 0, tone,
}) => (
  <g className="fp-furniture" transform={`translate(${cx} ${cy}) rotate(${rot})`} style={tone ? { fill: tone } : undefined}>
    <rect x={-r} y={-r * 0.8} width={r * 2} height={r * 1.6} rx={r * 0.35} />
    <path d={`M ${-r} ${-r * 0.8} L ${-r} ${-r * 1.15} L ${r} ${-r * 1.15} L ${r} ${-r * 0.8}`} />
  </g>
);

export const RoundTable: React.FC<{ cx: number; cy: number; r: number; seats?: number }> = ({
  cx, cy, r, seats = 4,
}) => (
  <g className="fp-furniture">
    <circle cx={cx} cy={cy} r={r} />
    {Array.from({ length: seats }, (_, i) => {
      const a = (Math.PI * 2 * i) / seats - Math.PI / 2;
      return (
        <Chair
          key={i}
          cx={cx + Math.cos(a) * (r + 14)}
          cy={cy + Math.sin(a) * (r + 14)}
          r={12}
          rot={(a * 180) / Math.PI + 90}
        />
      );
    })}
  </g>
);

/** Soft seating — the lavender blocks in the drawing's "open lounges". */
export const Sofa: React.FC<{ x: number; y: number; w: number; h: number; vertical?: boolean }> = ({
  x, y, w, h, vertical,
}) => {
  const n = Math.max(2, Math.round((vertical ? h : w) / 46));
  return (
    <g className="fp-lounge">
      <rect x={x} y={y} width={w} height={h} rx={5} />
      {Array.from({ length: n - 1 }, (_, i) =>
        vertical ? (
          <line key={i} x1={x} y1={y + (h / n) * (i + 1)} x2={x + w} y2={y + (h / n) * (i + 1)} />
        ) : (
          <line key={i} x1={x + (w / n) * (i + 1)} y1={y} x2={x + (w / n) * (i + 1)} y2={y + h} />
        ),
      )}
    </g>
  );
};

/** The drawing's little six-leaf planter rosette. */
export const Plant: React.FC<{ cx: number; cy: number; r?: number }> = ({ cx, cy, r = 21 }) => (
  <g className="fp-plant" transform={`translate(${cx} ${cy})`}>
    {Array.from({ length: 6 }, (_, i) => (
      <ellipse key={i} rx={r * 0.36} ry={r * 0.86} transform={`rotate(${i * 60})`} />
    ))}
    <circle r={r * 0.22} className="fp-plant-core" />
  </g>
);

/** Door leaf + swing arc. `a` is the closed-leaf bearing in degrees. */
export const Door: React.FC<{ x: number; y: number; r: number; a: number; dir?: 1 | -1 }> = ({
  x, y, r, a, dir = 1,
}) => {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = x + r * Math.cos(rad(a));
  const y1 = y + r * Math.sin(rad(a));
  const a2 = a + 90 * dir;
  const x2 = x + r * Math.cos(rad(a2));
  const y2 = y + r * Math.sin(rad(a2));
  return (
    <g className="fp-door">
      <line x1={x} y1={y} x2={x1} y2={y1} className="fp-door-opening" />
      <line x1={x} y1={y} x2={x2} y2={y2} className="fp-door-leaf" />
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${x2} ${y2}`} className="fp-door-arc" />
    </g>
  );
};

/** Stair run drawn as treads, used for both fire stairs. */
export const Stairs: React.FC<{ x: number; y: number; w: number; h: number; steps?: number; vertical?: boolean }> = ({
  x, y, w, h, steps = 9, vertical,
}) => (
  <g className="fp-furniture">
    <rect x={x} y={y} width={w} height={h} />
    {Array.from({ length: steps - 1 }, (_, i) =>
      vertical ? (
        <line key={i} x1={x} y1={y + (h / steps) * (i + 1)} x2={x + w} y2={y + (h / steps) * (i + 1)} />
      ) : (
        <line key={i} x1={x + (w / steps) * (i + 1)} y1={y} x2={x + (w / steps) * (i + 1)} y2={y + h} />
      ),
    )}
  </g>
);
