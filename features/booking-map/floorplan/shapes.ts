import type { Shape } from '../booking/types';

export interface Box { x: number; y: number; w: number; h: number }

export function bbox(shape: Shape): Box {
  if (shape.t === 'rect') return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
  const xs = shape.pts.map((p) => p[0]);
  const ys = shape.pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function centroid(shape: Shape): [number, number] {
  const b = bbox(shape);
  return [b.x + b.w / 2, b.y + b.h / 2];
}

/**
 * Path for a shape, optionally inset by `d` plan units so the interaction
 * outline reads as its own line just inside the wall poché.
 */
export function pathFor(shape: Shape, d = 0): string {
  if (shape.t === 'rect') {
    const w = Math.max(2, shape.w - d * 2);
    const h = Math.max(2, shape.h - d * 2);
    const x = shape.x + (shape.w - w) / 2;
    const y = shape.y + (shape.h - h) / 2;
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  const [cx, cy] = centroid(shape);
  const pts = shape.pts.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const f = Math.max(0.05, (len - d) / len);
    return [cx + dx * f, cy + dy * f];
  });
  return `M ${pts.map((p) => p.join(' ')).join(' L ')} Z`;
}

/** Reading order: banded rows top→bottom, then left→right within a band. */
export function readingOrder<T extends { shape: Shape }>(items: T[], band = 200): T[] {
  return [...items].sort((a, b) => {
    const ca = centroid(a.shape);
    const cb = centroid(b.shape);
    const ra = Math.floor(ca[1] / band);
    const rb = Math.floor(cb[1] / band);
    return ra === rb ? ca[0] - cb[0] : ra - rb;
  });
}

/**
 * Spatial arrow navigation: cast a ±45° cone from `from` and take the candidate
 * with the smallest `distance / cos(angle off axis)`. Falls back to the nearest
 * candidate anywhere in the hemisphere when the cone is empty.
 */
export function nearestInDirection(
  from: [number, number],
  dir: 'up' | 'down' | 'left' | 'right',
  candidates: Array<{ id: string; at: [number, number] }>,
): string | null {
  const axis: Record<typeof dir, [number, number]> = {
    up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  } as const;
  const [ax, ay] = axis[dir];
  let bestCone: { id: string; score: number } | null = null;
  let bestHemi: { id: string; score: number } | null = null;

  for (const c of candidates) {
    const dx = c.at[0] - from[0];
    const dy = c.at[1] - from[1];
    const dist = Math.hypot(dx, dy);
    if (dist < 1) continue;
    const cos = (dx * ax + dy * ay) / dist;
    if (cos <= 0.05) continue;
    const hemiScore = dist / cos;
    if (!bestHemi || hemiScore < bestHemi.score) bestHemi = { id: c.id, score: hemiScore };
    if (cos >= Math.SQRT1_2) {
      const score = dist / cos;
      if (!bestCone || score < bestCone.score) bestCone = { id: c.id, score };
    }
  }
  return (bestCone ?? bestHemi)?.id ?? null;
}
