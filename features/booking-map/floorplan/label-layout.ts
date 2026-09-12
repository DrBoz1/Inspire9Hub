export type LabelBox = { left: number; top: number; w: number; h: number };

/** Boxes use screen pixels, including chip padding and every visible text line. */
export function labelsOverlap(a: LabelBox, b: LabelBox, gap = 5): boolean {
  return Math.abs(a.left - b.left) < (a.w + b.w) / 2 + gap &&
    Math.abs(a.top - b.top) < (a.h + b.h) / 2 + gap;
}

export function keepLabelInView(box: LabelBox, width: number, height: number): LabelBox {
  const w = Math.min(box.w, Math.max(0, width - 12));
  const h = Math.min(box.h, Math.max(0, height - 12));
  return { ...box, w, h,
    left: Math.max(w / 2 + 6, Math.min(width - w / 2 - 6, box.left)),
    top: Math.max(h / 2 + 6, Math.min(height - h / 2 - 6, box.top)),
  };
}
