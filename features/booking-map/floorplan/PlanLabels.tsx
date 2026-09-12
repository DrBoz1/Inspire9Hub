import React, { useMemo } from 'react';
import type { Availability, Space } from '../booking/types';
import { DESK_BANK_ORIGINS, DESK_W } from './plan';
import { bbox, centroid } from './shapes';
import type { Box, Transform } from './usePanZoom';
import { keepLabelInView, labelsOverlap, type LabelBox } from './label-layout';

export const STATUS_GLYPH: Record<Availability, string> = {
  available: '●', partial: '◐', booked: '×', mine: '✓', closed: '', unknown: '?',
};
const STATUS_COLOR: Record<Availability, string> = {
  available: 'var(--color-status-available-ink)', partial: 'var(--color-status-partial-ink)',
  booked: 'var(--color-status-full-ink)', mine: 'var(--color-status-mine-ink)',
  closed: 'var(--color-ink-400)', unknown: 'var(--color-ink-400)',
};
const SHORT_NAME: Record<string, string> = {
  'training-room': 'Training', 'meeting-a': 'Meeting A', 'meeting-b': 'Meeting B',
  'meeting-c': 'Meeting C', 'meeting-d': 'Meeting D', boardroom: 'Boardroom',
  'office-1a': '1.A', 'office-1b': '1.B', 'office-1c': '1.C', 'office-1de': '1.D+E',
  'bay-b': 'Bay B', 'bay-c': 'Bay C', 'bay-d': 'Bay D',
  'workpoint-n': 'Workpoint', 'workpoint-s': 'Workpoint',
  'pod-n': 'Pod North', 'pod-s': 'Pod South', 'wc-accessible': 'Accessible WC',
  wc: 'WC', games: 'Games', 'lounge-n': 'Lounge', lift: 'Lift',
};
interface Placed extends LabelBox { key: string; node: React.ReactNode }
interface Props {
  spaces: Space[]; status: Map<string, Availability>; visible: Set<string>;
  selectedId: string | null; hoveredId: string | null; subline: Map<string, string>;
  transform: Transform; renderScale: number; viewBox: Box; size: { w: number; h: number };
}

// A deliberately roomy estimate. The rendered box uses this exact width and
// truncates unusually wide names, so visual bounds and collision bounds agree.
const textWidth = (text: string, px = 12) => Math.ceil(text.length * px * .66);

export function PlanLabels({ spaces, status, visible, selectedId, hoveredId, subline, transform, renderScale, viewBox, size }: Props) {
  const nodes = useMemo(() => {
    const { k } = transform;
    const ox = (size.w - viewBox.w * renderScale) / 2;
    const oy = (size.h - viewBox.h * renderScale) / 2;
    const point = (x: number, y: number) => ({
      left: ox + (x * k + transform.x - viewBox.x) * renderScale,
      top: oy + (y * k + transform.y - viewBox.y) * renderScale,
    });
    const unit = k * renderScale;
    const placed: Placed[] = [];
    const push = (item: Placed, force = false) => {
      if (item.left < 0 || item.top < 0 || item.left > size.w || item.top > size.h) return;
      const candidate = force ? { ...item, ...keepLabelInView(item, size.w, size.h) } : item;
      if (!force && (candidate.left - candidate.w / 2 < 4 || candidate.left + candidate.w / 2 > size.w - 4 || candidate.top - candidate.h / 2 < 4 || candidate.top + candidate.h / 2 > size.h - 4)) return;
      if (!placed.some(other => labelsOverlap(other, candidate))) placed.push(candidate);
    };
    const rank = (s: Space) => s.id === selectedId ? 3 : s.id === hoveredId ? 2 : s.bookable || s.unlinked ? 1 : 0;
    const priority = spaces.filter(s => visible.has(s.id)).sort((a, b) => {
      const aBox = bbox(a.shape), bBox = bbox(b.shape);
      return rank(b) - rank(a) || bBox.w * bBox.h - aBox.w * aBox.h;
    });

    // Selected rooms get first claim on the canvas; zone headings never suppress them.
    for (const s of priority) {
      const b = bbox(s.shape);
      const [cx, cy] = s.labelAt ?? centroid(s.shape);
      const position = point(cx, cy);
      const width = b.w * unit, height = b.h * unit;
      const forced = s.id === selectedId || s.id === hoveredId;
      if (s.label === 'none' && !forced) continue;
      const isSpace = s.bookable || s.unlinked;
      if (!isSpace) {
        const name = SHORT_NAME[s.id] ?? s.name;
        const w = textWidth(name, 10) + 12;
        if (!forced && (height < 22 || w > width)) continue;
        push({ key: s.id, ...position, w, h: 20, node: <span className="fp-label-amenity">{name}</span> }, forced);
        continue;
      }
      if (!forced && s.label === 'code' && (s.kind === 'desk' || s.kind === 'collab_table') && unit < .75) continue;
      let name = s.name;
      if (!forced && textWidth(name) + 24 > width) name = SHORT_NAME[s.id] ?? s.code;
      if (!forced && textWidth(name) + 24 > width) name = s.code;
      const showGlyph = name !== s.code;
      if (!forced && (textWidth(name) + (showGlyph ? 32 : 20) > width || height < 25)) continue;
      const st = status.get(s.id) ?? 'unknown';
      const detail = forced ? subline.get(s.id) : unit > .75 && height > 62 ? `${s.capacity} ${s.capacity === 1 ? 'person' : 'people'}` : undefined;
      const code = forced && name !== s.code ? s.code : undefined;
      const w = Math.min(forced ? 250 : width - 6, Math.max(textWidth(name) + (showGlyph ? 26 : 14), detail ? textWidth(detail, 11) + 18 : 0));
      const h = 24 + (detail ? 15 : 0) + (code ? 13 : 0);
      push({ key: s.id, ...position, w, h,
        node: <span className={`fp-label-card${forced ? ' fp-label-card-active' : ''}`}>
          <span className="fp-label-name">{showGlyph && <span style={{ color: STATUS_COLOR[st] }} className="fp-label-glyph">{STATUS_GLYPH[st]}</span>}{name}</span>
          {detail && <span className="fp-label-sub">{detail}</span>}
          {code && <span className="fp-label-sub fp-label-code">{code}</span>}
        </span>,
      }, forced);
    }

    const banners: Array<[number, number, string]> = [
      [866, 260, 'NORTH HOT DESKS'], [1594, 727, 'LOUNGE PODS'], [350, 588, 'TEAM WORK BAYS'],
    ];
    if (unit >= .25) {
      for (const [x, y, name] of banners) push({ key: name, ...point(x, y), w: textWidth(name, 10) + 16, h: 18, node: <span className="fp-label-banner">{name}</span> });
      push({ key: 'phone-booths', ...point(940, 346), w: 108, h: 18, node: <span className="fp-label-banner">PHONE BOOTHS</span> });
    }
    if (unit < .75) DESK_BANK_ORIGINS.forEach(([x], i) => {
      push({ key: `bank-${i}`, ...point(x + DESK_W, 1118), w: 48, h: 18, node: <span className="fp-label-banner">BANK {'ABCDEF'[i]}</span> });
    });
    return placed;
  }, [spaces, status, visible, selectedId, hoveredId, subline, transform, renderScale, viewBox, size]);

  return <div className="fp-labels" aria-hidden="true">{nodes.map(n => <div key={n.key} data-label={n.key} className="fp-label" style={{ left: n.left, top: n.top, width: n.w, height: n.h }}>{n.node}</div>)}</div>;
}
