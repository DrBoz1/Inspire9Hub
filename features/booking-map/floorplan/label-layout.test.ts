import { describe, expect, it } from 'vitest';
import { keepLabelInView, labelsOverlap } from './label-layout';

describe('floor plan labels in screen space', () => {
  it('reserves all three lines of a selected room before placing its neighbour', () => {
    const selected = { left: 200, top: 200, w: 170, h: 52 };
    expect(labelsOverlap(selected, { left: 200, top: 233, w: 70, h: 24 })).toBe(true);
    expect(labelsOverlap(selected, { left: 200, top: 247, w: 70, h: 24 })).toBe(false);
  });
  it('keeps a selected room label inside narrow and resized viewports', () => {
    for (const width of [160, 320, 440, 960]) {
      for (const left of [-10, 5, width / 2, width - 5, width + 10]) {
        const label = keepLabelInView({ left, top: 4, w: 250, h: 52 }, width, 300);
        expect(label.left - label.w / 2).toBeGreaterThanOrEqual(6);
        expect(label.left + label.w / 2).toBeLessThanOrEqual(width - 6);
        expect(label.top - label.h / 2).toBeGreaterThanOrEqual(6);
      }
    }
  });
});
