/**
 * Inspire9 — Level 1 floor plan geometry.
 *
 * Every coordinate below is in **plan units**, which are the pixel coordinates of
 * `public/floorplan.png` (2196 × 1556). Keeping the source drawing's own coordinate
 * space means the traced vector plan and the original raster overlay perfectly —
 * see the "Trace overlay" toggle in the dev tools panel.
 *
 * Wall centrelines and room boundaries were extracted from the drawing by scanning
 * dark-pixel runs across horizontal/vertical bands, so partitions land on the same
 * lines the architect drew (interior partitions measure 8–9px, i.e. ~200mm).
 */

/** Drawing extent we actually render (trims the PNG's legend + margin). */
export const PLAN_VIEWBOX = { x: 60, y: 60, w: 2110, h: 1360 } as const;

/** Building envelope, wall centrelines. */
export const ENVELOPE = { left: 105, top: 105, right: 2117, bottom: 1368 } as const;

/** Scale factor: the envelope is ~48m × 29m in the real building. */
export const PX_PER_M = (ENVELOPE.right - ENVELOPE.left) / 48;

export const metres = (px: number) => px / PX_PER_M;

export type WallClass = 'perimeter' | 'partition' | 'glass' | 'lowwall';

export interface Wall {
  /** [x1, y1, x2, y2] centreline */
  l: [number, number, number, number];
  c: WallClass;
}

const w = (x1: number, y1: number, x2: number, y2: number, c: WallClass = 'partition'): Wall => ({
  l: [x1, y1, x2, y2],
  c,
});

export const WALLS: Wall[] = [
  // ─── Building envelope ────────────────────────────────────────────────────
  w(105, 105, 2117, 105, 'perimeter'),
  w(2117, 105, 2117, 1368, 'perimeter'),
  w(2117, 1368, 105, 1368, 'perimeter'),
  w(105, 1368, 105, 105, 'perimeter'),

  // ─── North-west: lift lobby + riser cupboard ──────────────────────────────
  w(296, 105, 296, 234),
  w(105, 234, 296, 234),
  w(450, 105, 450, 196),
  w(296, 196, 450, 196),

  // ─── North-central: partition closing the café run ────────────────────────
  w(1403, 105, 1403, 350),

  // ─── Phone booth row (open to the north, 4 booths) ────────────────────────
  w(762, 355, 762, 447),
  w(841, 355, 841, 447),
  w(924, 355, 924, 447),
  w(1005, 355, 1005, 447),
  w(1112, 355, 1112, 447),
  w(760, 447, 1112, 447),

  // ─── Training room ────────────────────────────────────────────────────────
  w(760, 447, 760, 809),
  w(1084, 447, 1084, 809),
  w(760, 809, 1084, 809),

  // ─── Meeting rooms A + B ──────────────────────────────────────────────────
  w(760, 809, 760, 955),
  w(927, 809, 927, 955),
  w(1084, 809, 1084, 955),
  w(760, 955, 1084, 955),

  // ─── Private office block 1.A / 1.B / 1.C / 1.D+E ─────────────────────────
  w(1084, 503, 1447, 503),
  w(1084, 959, 1447, 959),
  w(1084, 503, 1084, 959),
  w(1447, 503, 1447, 959),
  w(1256, 503, 1256, 959),
  w(1084, 709, 1256, 709),
  w(1256, 638, 1447, 638),

  // ─── East meeting rooms ───────────────────────────────────────────────────
  w(1749, 535, 1809, 535),
  w(1749, 535, 1749, 925),
  w(1809, 535, 1809, 731),
  w(1749, 731, 1894, 731),
  w(1894, 731, 1894, 925),
  w(1749, 925, 1894, 925),

  // ─── Washrooms (5 stalls + accessible WC/shower) ──────────────────────────
  w(1894, 536, 2117, 536),
  w(1894, 536, 1894, 925),
  w(2002, 591, 2117, 591),
  w(2002, 650, 2117, 650),
  w(2002, 706, 2117, 706),
  w(2002, 768, 2117, 768),
  w(1894, 830, 2117, 830),
  w(2002, 830, 2002, 925),

  // ─── Boardroom ────────────────────────────────────────────────────────────
  w(1894, 925, 2117, 925),
  w(1763, 925, 1763, 1143, 'glass'),
  w(1731, 1143, 2117, 1143),

  // ─── Fire stairs ──────────────────────────────────────────────────────────
  w(1731, 1143, 1731, 1368),
  w(479, 1225, 479, 1368),
  w(105, 1225, 479, 1225),

  // ─── South workstation zone spine ─────────────────────────────────────────
  w(1103, 1140, 1103, 1368),
];

/** Inner glazing line, drawn parallel to the perimeter along the window runs. */
export const GLAZING: Array<[number, number, number, number]> = [
  [380, 118, 2040, 118], // north facade
  [118, 255, 118, 1160], // west facade
  [500, 1355, 1700, 1355], // south facade
];

/** Structural columns picked off the facade. */
export const COLUMNS: Array<[number, number]> = [
  [105, 420], [105, 700], [105, 980], [105, 1160],
  [640, 105], [1050, 105], [1550, 105], [1980, 105],
];

export interface DoorArc {
  /** Hinge point. */
  x: number;
  y: number;
  /** Leaf length. */
  r: number;
  /** Degrees: direction the closed leaf points. */
  a: number;
  /** Swing direction. */
  dir: 1 | -1;
}

const d = (x: number, y: number, r: number, a: number, dir: 1 | -1 = 1): DoorArc => ({ x, y, r, a, dir });

export const DOORS: DoorArc[] = [
  // Training room — three leaves onto the west corridor
  d(760, 460, 62, 90, 1),
  d(760, 600, 62, 90, 1),
  d(760, 740, 62, 90, 1),
  // Meeting rooms A + B
  d(830, 955, 58, 270, -1),
  d(1000, 955, 58, 270, -1),
  // Offices
  d(1160, 503, 60, 0, 1),
  d(1300, 503, 60, 0, -1),
  d(1160, 959, 60, 180, 1),
  d(1330, 959, 60, 180, -1),
  d(1447, 760, 58, 180, 1),
  // East meeting rooms
  d(1749, 548, 55, 0, -1),
  d(1749, 912, 55, 180, 1),
  // Washroom stalls
  d(2002, 545, 52, 0, -1),
  d(2002, 604, 52, 0, -1),
  d(2002, 662, 52, 0, -1),
  d(2002, 718, 52, 0, -1),
  d(2002, 780, 52, 0, -1),
  d(2002, 842, 52, 0, -1),
  // Fire stairs
  d(479, 1240, 62, 180, -1),
  d(1731, 1290, 62, 0, 1),
];

// ───────────────────────────────────────────────────────────────────────────
// Furniture — traced as data so the whole drawing stays declarative.
// ───────────────────────────────────────────────────────────────────────────

export interface RectItem { x: number; y: number; w: number; h: number; r?: number }

/**
 * Storage / touchdown grid tables along the north window line. Traced from the
 * drawing's own hairlines (verticals at 496·540·584, 1176·1220·1264, 1350·1396;
 * horizontals at 184·264·324). Drawn as context — the client has not yet
 * confirmed whether these are bookable, so they carry no space record.
 */
export const NORTH_GRID_TABLES: RectItem[] = [
  { x: 496, y: 112, w: 88, h: 272 },
  { x: 1176, y: 112, w: 88, h: 272 },
  { x: 1350, y: 112, w: 46, h: 278 },
];

/** Six workstation banks in the south zone: 6 desks each (2 × 3). */
export const DESK_BANK_ORIGINS: Array<[number, number]> = [
  [544, 1148], [736, 1148], [932, 1148],
  [1191, 1148], [1385, 1148], [1586, 1148],
];
export const DESK_W = 44;
export const DESK_H = 69;

/**
 * The north "HOT DESK ZONE": three clusters of 2 × 2 individual desks, drawn in
 * the drawing's cyan. Cluster origins and cell sizes come from a colour-cluster
 * scan of the source PNG (#AAE6EE runs at x 637-725 / 827-916 / 978-1066,
 * y 113-161 / 168-217).
 */
export const CAFE_CLUSTER_X = [637, 827, 978];
export const CAFE_ROW_Y = [113, 168];
export const CAFE_DESK_W = 44;
export const CAFE_DESK_H = 48;
export const CAFE_COL_GAP = 45;

/** Octagonal lounge pods (the cyan "hot desk zone" islands). */
export const POD_N = { cx: 1596, cy: 598, r: 104 };
export const POD_S = { cx: 1591, cy: 850, r: 104 };

export function octagonPoints(cx: number, cy: number, r: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Planters, drawn as the plan's little green rosettes. */
export const PLANTS: Array<[number, number]> = [
  [104, 292], [345, 205], [345, 258], [640, 645], [716, 470],
  [975, 130], [1140, 130], [1500, 128], [1508, 402], [1235, 620],
  [790, 990], [640, 1113], [1006, 1112], [1443, 1113], [1596, 598], [1591, 850],
];

/**
 * Lounge / breakout soft seating — the lavender "OPEN LOUNGES" of the legend.
 * Positions from a #CCC1D9 colour-cluster scan.
 */
export const LOUNGE_SOFAS: RectItem[] = [
  { x: 665, y: 819, w: 87, h: 37 },
  { x: 665, y: 922, w: 87, h: 37 },
];
/** Breakout bench + privacy screen beside the north-central partition. */
export const BREAKOUT_BENCH = { x: 1414, y: 168, w: 44, h: 152 };
export const BREAKOUT_SCREEN = { x: 1488, y: 172, w: 14, h: 148 };
/** The two armchairs of the north open lounge. */
export const LOUNGE_CHAIRS: Array<{ x: number; y: number; rot: number }> = [
  { x: 1622, y: 148, rot: -22 },
  { x: 1697, y: 152, rot: 18 },
];

export const KITCHEN = { x: 1893, y: 158, w: 66, h: 344 };
export const KITCHEN_CHAIR_X_L = 1869;
export const KITCHEN_CHAIR_X_R = 1983;
export const KITCHEN_CHAIRS_L = [198, 250, 302, 354, 406, 458];
export const KITCHEN_CHAIRS_R = [214, 266, 318, 370, 422, 474];

export const POOL_TABLE = { x: 1595, y: 258, w: 182, h: 95 };

export interface PlanLabel {
  x: number;
  y: number;
  text: string;
  size?: number;
  weight?: number;
  rotate?: number;
  tone?: 'ink' | 'muted' | 'alert';
  anchor?: 'start' | 'middle' | 'end';
}

/**
 * Annotations that belong to the drawing itself rather than to a bookable
 * space. These scale with the plan; every *space* label lives in the HTML
 * label layer at a constant screen size instead (see PlanLabels).
 */
export const PLAN_LABELS: PlanLabel[] = [
  { x: 292, y: 1258, text: 'FIRE EXIT STAIRS', size: 26, weight: 700, tone: 'alert' },
  { x: 1924, y: 1188, text: 'FIRE EXIT STAIRS', size: 26, weight: 700, tone: 'alert' },
  { x: 1926, y: 330, text: 'KITCHEN', size: 28, weight: 700, rotate: 90 },
];
