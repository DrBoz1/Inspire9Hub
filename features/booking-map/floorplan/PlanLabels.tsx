import React, { useMemo } from 'react';
import type { Availability, Space } from '../booking/types';
import { DESK_BANK_ORIGINS, DESK_W } from './plan';
import { bbox, centroid } from './shapes';
import type { Box, Transform } from './usePanZoom';

/** Status glyph — the third redundancy channel alongside hue and hatch. */
export const STATUS_GLYPH: Record<Availability, string> = {
  available: '●',
  partial: '◐',
  booked: '✕',
  mine: '✓',
  closed: '',
};

const STATUS_COLOR: Record<Availability, string> = {
  available: 'var(--color-status-available-ink)',
  partial: 'var(--color-status-partial-ink)',
  booked: 'var(--color-status-full-ink)',
  mine: 'var(--color-status-mine-ink)',
  closed: 'var(--color-ink-400)',
};

/** Names that must shorten before they fall back to a bare code. */
const SHORT_NAME: Record<string, string> = {
  'training-room': 'Training',
  'meeting-a': 'Meeting A',
  'meeting-b': 'Meeting B',
  'meeting-c': 'Meeting C',
  'meeting-d': 'Meeting D',
  boardroom: 'Boardroom',
  'office-1de': '1.D+E',
  'bay-b': 'Bay B',
  'bay-c': 'Bay C',
  'bay-d': 'Bay D',
  'workpoint-n': 'High workpoint',
  'workpoint-s': 'High workpoint',
  'pod-n': 'Pod North',
  'pod-s': 'Pod South',
  'wc-accessible': 'Accessible',
  wc: 'WC',
  games: 'Games',
  'lounge-n': 'Open lounge',
  lift: 'Lift',
};

interface Placed {
  key: string;
  left: number;
  top: number;
  w: number;
  h: number;
  node: React.ReactNode;
}

interface Props {
  spaces: Space[];
  status: Map<string, Availability>;
  visible: Set<string>;
  selectedId: string | null;
  hoveredId: string | null;
  subline: Map<string, string>;
  transform: Transform;
  renderScale: number;
  viewBox: Box;
  /** Rendered size of the SVG box, needed for the letterbox offset. */
  size: { w: number; h: number };
}

/**
 * Roboto Condensed advance width, measured: ~0.54 em at semibold for mixed-case
 * names, ~0.50 em for the short uppercase codes. Cheaper and steadier than a
 * DOM measurement pass, and only needs to be right to within a few pixels.
 */
const estWidth = (text: string, px: number, tight = false) =>
  text.length * px * (tight ? 0.5 : 0.54) + 5;

/**
 * Labels live in an HTML layer above the SVG at a constant screen size, so a
 * room name never grows into a banner or shrinks below the legibility floor
 * (spec §3.3). One greedy screen-space collision pass per render.
 */
export function PlanLabels({
  spaces, status, visible, selectedId, hoveredId, subline, transform, renderScale, viewBox, size,
}: Props) {
  const { k } = transform;

  const nodes = useMemo(() => {
    // preserveAspectRatio="xMidYMid meet" centres the viewBox inside the SVG
    // box, so the label layer has to add the same letterbox offset or it drifts
    // — invisibly on a wide viewport, catastrophically on a tall one.
    const ox = (size.w - viewBox.w * renderScale) / 2;
    const oy = (size.h - viewBox.h * renderScale) / 2;
    const toScreen = (px: number, py: number) => ({
      left: ox + (px * k + transform.x - viewBox.x) * renderScale,
      top: oy + (py * k + transform.y - viewBox.y) * renderScale,
    });
    const unit = k * renderScale; // screen px per plan unit

    const placed: Placed[] = [];
    const fits = (c: Placed) =>
      !placed.some(
        (p) =>
          Math.abs(p.left - c.left) < (p.w + c.w) / 2 + 2 &&
          Math.abs(p.top - c.top) < (p.h + c.h) / 2 + 2,
      );
    const push = (c: Placed) => {
      if (fits(c)) placed.push(c);
    };

    // ── Zone banners, quoted from the drawing's own legend ─────────────────
    const banners: Array<[number, number, string]> = [
      [852, 248, 'Hot desk zone'],
      [1594, 726, 'Hot desk zone'],
      [312, 585, 'Team bays'],
    ];
    for (const [x, y, text] of banners) {
      const p = toScreen(x, y);
      push({
        key: `banner-${text}-${x}`,
        left: p.left, top: p.top,
        w: estWidth(text, 11, true) + 20, h: 16,
        node: <span className="fp-label-banner">{text}</span>,
      });
    }

    // ── Phone-booth bracket: the drawing's own solution, reused ────────────
    {
      const p = toScreen(937, 338);
      push({
        key: 'bracket-booths',
        left: p.left, top: p.top,
        w: Math.max(96, 350 * unit), h: 18,
        node: (
          <span
            className="fp-label-banner fp-label-bracket"
            style={{ display: 'inline-block', width: Math.max(96, 350 * unit), paddingTop: 2 }}
          >
            Phone booths
          </span>
        ),
      });
    }

    // ── Desk bank letters, shown instead of 36 codes at overview zoom ──────
    if (k < 1.45) {
      DESK_BANK_ORIGINS.forEach(([ox], i) => {
        const p = toScreen(ox + DESK_W, 1126);
        push({
          key: `bank-${i}`,
          left: p.left, top: p.top, w: 54, h: 14,
          node: <span className="fp-label-banner">Bank {'ABCDEF'[i]}</span>,
        });
      });
    }

    // ── Space labels, highest priority first ───────────────────────────────
    const priority = [...spaces]
      .filter((s) => visible.has(s.id))
      .sort((a, b) => {
        const rank = (s: Space) =>
          s.id === selectedId ? 3 : s.id === hoveredId ? 2 : s.bookable ? 1 : 0;
        const dr = rank(b) - rank(a);
        if (dr !== 0) return dr;
        const ba = bbox(a.shape);
        const bb = bbox(b.shape);
        return bb.w * bb.h - ba.w * ba.h;
      });

    for (const s of priority) {
      const b = bbox(s.shape);
      const [cx, cy] = s.labelAt ?? centroid(s.shape);
      const p = toScreen(cx, cy);
      const wPx = b.w * unit;
      const hPx = b.h * unit;
      const isSel = s.id === selectedId;
      const isHov = s.id === hoveredId;
      const forced = isSel || isHov;

      // Never label something that is essentially off-screen.
      if (p.left < -160 || p.top < -60 || p.left > size.w + 160 || p.top > size.h + 60) continue;

      if (!s.bookable) {
        // `label: 'none'` means the drawing already names it (KITCHEN, the fire
        // stairs) — don't print a second, competing label over the top.
        if (s.label === 'none' && !forced) continue;
        const text = SHORT_NAME[s.id] ?? s.name;
        if (!forced && (hPx < 22 || estWidth(text, 10, true) > wPx + 30)) continue;
        push({
          key: `l-${s.id}`, left: p.left, top: p.top,
          w: estWidth(text, 10, true), h: 14,
          node: <span className="fp-label-amenity">{text}</span>,
        });
        continue;
      }

      const st = status.get(s.id) ?? 'available';
      const tierSub = forced || k >= 1.6;
      const tierCode = forced || k >= 2.6;

      // Fitting ladder: full name → short name → code → nothing.
      let text = s.name;
      let style: 'name' | 'code' = 'name';
      if (!forced && estWidth(text, 12) > wPx - 6) {
        text = SHORT_NAME[s.id] ?? s.name;
        if (estWidth(text, 12) > wPx - 6) {
          text = s.code;
          style = 'code';
          if (estWidth(text, 11, true) > wPx - 2 || hPx < 15) continue;
        }
      }
      if (s.label === 'code' && !forced) {
        // Desks and booths are code-only until you zoom in.
        if (k < 1.45 && s.kind === 'desk') continue;
        text = s.code;
        style = 'code';
        if (estWidth(text, 11, true) > wPx - 2 || hPx < 14) continue;
      }

      const sub = tierSub ? subline.get(s.id) : undefined;
      const width = Math.max(estWidth(text, 12), sub ? estWidth(sub, 11) : 0);

      push({
        key: `l-${s.id}`,
        left: p.left,
        top: p.top,
        w: width,
        h: sub ? 30 : 15,
        node: (
          <span
            className={forced ? 'fp-label-chip' : undefined}
            style={forced ? { display: 'inline-block' } : undefined}
          >
            <span className={style === 'code' ? 'fp-label-code' : 'fp-label-name'}>
              <span style={{ color: STATUS_COLOR[st], marginRight: 4, fontSize: 9 }} aria-hidden>
                {STATUS_GLYPH[st]}
              </span>
              {text}
            </span>
            {sub && <span className="fp-label-sub" style={{ display: 'block' }}>{sub}</span>}
            {tierCode && style !== 'code' && (
              <span
                className="fp-label-sub"
                style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10 }}
              >
                {s.code}
              </span>
            )}
          </span>
        ),
      });
    }

    return placed;
  }, [
    hoveredId, k, renderScale, selectedId, size.h, size.w, spaces, status, subline,
    transform.x, transform.y, viewBox.h, viewBox.w, viewBox.x, viewBox.y, visible,
  ]);

  return (
    <div className="fp-labels" aria-hidden="true">
      {nodes.map((n) => (
        <div key={n.key} className="fp-label" style={{ left: n.left, top: n.top }}>
          {n.node}
        </div>
      ))}
    </div>
  );
}
