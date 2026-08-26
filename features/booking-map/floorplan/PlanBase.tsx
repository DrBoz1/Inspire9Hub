import React from 'react';
import {
  WALLS, GLAZING, DOORS, COLUMNS, PLAN_LABELS,
  NORTH_GRID_TABLES, DESK_BANK_ORIGINS, DESK_W, DESK_H,
  CAFE_CLUSTER_X, CAFE_ROW_Y, CAFE_DESK_W, CAFE_DESK_H, CAFE_COL_GAP,
  POD_N, POD_S, PLANTS, LOUNGE_SOFAS, KITCHEN, BREAKOUT_BENCH, BREAKOUT_SCREEN,
  LOUNGE_CHAIRS, KITCHEN_CHAIR_X_L, KITCHEN_CHAIR_X_R,
  KITCHEN_CHAIRS_L, KITCHEN_CHAIRS_R, POOL_TABLE, octagonPoints,
} from './plan';
import { Chair, Desk, Door, Plant, RoundTable, Sofa, Stairs } from './PlanFurniture';

const poly = (pts: Array<[number, number]>) => pts.map((p) => p.join(',')).join(' ');

const OFFICE_FURNITURE: Array<[number, number, number, number]> = [
  [1096, 540, 44, 74], [1096, 624, 44, 76], [1182, 536, 46, 66], [1182, 612, 46, 82],
  [1096, 728, 44, 88], [1096, 828, 44, 72], [1182, 722, 46, 82], [1182, 816, 46, 74],
  [1272, 590, 76, 34], [1360, 590, 76, 34],
  [1268, 654, 108, 38], [1352, 720, 54, 92], [1352, 824, 54, 92], [1272, 758, 66, 54],
];

/**
 * Layers 1, 4, 5 and 6 of the spec's stack: slab, zone washes, poché, fixtures
 * and furniture. Static and memoised, so pan/zoom never re-renders the drawing.
 */
export const PlanBase = React.memo(function PlanBase() {
  return (
    <>
      {/* ── #sheet ────────────────────────────────────────────────────────── */}
      <rect className="fp-slab" x={105} y={105} width={2012} height={1263} />

      {/* ── #zones: the drawing's own cyan wash on the two lounge pods ────── */}
      <g className="fp-zone-hotdesk">
        <polygon points={poly(octagonPoints(POD_N.cx, POD_N.cy, POD_N.r))} />
        <polygon points={poly(octagonPoints(POD_S.cx, POD_S.cy, POD_S.r))} />
      </g>
    </>
  );
});

/**
 * Everything drawn above the availability wash: poché, glazing, doors,
 * furniture and the drawing's fixed annotations.
 */
export const PlanInk = React.memo(function PlanInk({ furnitureOpacity }: { furnitureOpacity: number }) {
  return (
    <g aria-hidden="true">
      {/* ── #furniture ────────────────────────────────────────────────────── */}
      <g className="fp-furniture-layer" style={{ ['--furniture-opacity' as string]: furnitureOpacity }}>
        {/* Lift car + riser shelving */}
        <g className="fp-furniture">
          <rect x={124} y={116} width={152} height={104} rx={10} />
          <path d="M 168 200 L 168 140 M 168 140 L 157 153 M 168 140 L 179 153" className="fp-glyph" />
          <path d="M 214 140 L 214 200 M 214 200 L 203 187 M 214 200 L 225 187" className="fp-glyph" />
          <rect x={322} y={272} width={72} height={140} />
          <line x1={322} y1={318} x2={394} y2={318} />
          <line x1={322} y1={364} x2={394} y2={364} />
        </g>

        {/* North window-line grid tables */}
        {NORTH_GRID_TABLES.map((t, i) => (
          <g className="fp-furniture" key={`ngt${i}`}>
            <rect x={t.x} y={t.y} width={t.w} height={t.h} />
            {t.w > 60 && <line x1={t.x + t.w / 2} y1={t.y} x2={t.x + t.w / 2} y2={t.y + t.h} />}
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={t.x} y1={t.y + t.h * f} x2={t.x + t.w} y2={t.y + t.h * f} />
            ))}
          </g>
        ))}

        {/* North café hot desks — the drawing's cyan "HOT DESK ZONE" cells */}
        {CAFE_CLUSTER_X.map((ox) =>
          CAFE_ROW_Y.map((oy) =>
            [0, 1].map((col) => {
              const x = ox + col * CAFE_COL_GAP;
              return (
                <g key={`cafe-${ox}-${oy}-${col}`}>
                  <g className="fp-seat-hotdesk">
                    <rect x={x} y={oy} width={CAFE_DESK_W} height={CAFE_DESK_H} />
                  </g>
                  <g className="fp-seat">
                    <Chair
                      cx={col === 0 ? x - 15 : x + CAFE_DESK_W + 15}
                      cy={oy + CAFE_DESK_H / 2}
                      r={12}
                      rot={col === 0 ? -90 : 90}
                    />
                  </g>
                </g>
              );
            }),
          ),
        )}

        {/* Breakout bench + privacy screen */}
        <g className="fp-lounge">
          <Sofa {...BREAKOUT_BENCH} vertical />
        </g>
        <g className="fp-furniture">
          <rect
            x={BREAKOUT_SCREEN.x} y={BREAKOUT_SCREEN.y}
            width={BREAKOUT_SCREEN.w} height={BREAKOUT_SCREEN.h} rx={4}
          />
        </g>

        {/* North open lounge armchairs + coffee table */}
        <g className="fp-lounge">
          {LOUNGE_CHAIRS.map((c, i) => (
            <g key={`lc${i}`} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}>
              <rect x={-24} y={-20} width={48} height={40} rx={6} />
              <line x1={-24} y1={-8} x2={24} y2={-8} />
            </g>
          ))}
        </g>
        <g className="fp-furniture">
          <circle cx={1661} cy={186} r={18} />
        </g>
        <g className="fp-pool">
          <rect
            x={POOL_TABLE.x} y={POOL_TABLE.y} width={POOL_TABLE.w} height={POOL_TABLE.h}
            rx={7} className="fp-pool-frame"
          />
          <rect
            x={POOL_TABLE.x + 12} y={POOL_TABLE.y + 12}
            width={POOL_TABLE.w - 24} height={POOL_TABLE.h - 24} className="fp-pool-felt"
          />
          {[0, 0.5, 1].map((fx) =>
            [0, 1].map((fy) => (
              <circle
                key={`pk${fx}-${fy}`}
                cx={POOL_TABLE.x + 12 + (POOL_TABLE.w - 24) * fx}
                cy={POOL_TABLE.y + 12 + (POOL_TABLE.h - 24) * fy}
                r={6}
                className="fp-pool-pocket"
              />
            )),
          )}
        </g>

        {/* Kitchen: dining table, chairs and the angled counter run */}
        <g className="fp-furniture">
          <rect x={KITCHEN.x} y={KITCHEN.y} width={KITCHEN.w} height={KITCHEN.h} />
          <path d="M 2020 105 L 2112 190 L 2112 336 L 2084 336 L 2084 202 L 2000 126 Z" />
        </g>
        <g className="fp-seat-lounge">
          {KITCHEN_CHAIRS_L.map((y) => (
            <Chair key={`kl${y}`} cx={KITCHEN_CHAIR_X_L} cy={y} r={14} rot={-90} />
          ))}
          {KITCHEN_CHAIRS_R.map((y) => (
            <Chair key={`kr${y}`} cx={KITCHEN_CHAIR_X_R} cy={y} r={14} rot={90} />
          ))}
          <Chair cx={KITCHEN.x + KITCHEN.w / 2} cy={KITCHEN.y - 26} r={14} rot={180} />
        </g>

        {/* Training room in class layout */}
        <g className="fp-furniture">
          {[520, 620, 720].map((y) =>
            [800, 950].map((x) => (
              <g key={`tr${x}-${y}`}>
                <rect x={x} y={y} width={112} height={44} />
                <line x1={x + 56} y1={y} x2={x + 56} y2={y + 44} />
              </g>
            )),
          )}
        </g>

        {/* Meeting rooms A + B */}
        <RoundTable cx={843} cy={878} r={40} seats={6} />
        <RoundTable cx={1005} cy={878} r={40} seats={6} />

        {/* Private offices */}
        <g className="fp-furniture">
          {OFFICE_FURNITURE.map(([x, y, w, h], i) => (
            <rect key={`of${i}`} x={x} y={y} width={w} height={h} />
          ))}
          <path d="M 1398 646 a 26 26 0 0 1 26 26 l 0 34 a 26 26 0 0 1 -26 26 z" className="fp-soft" />
        </g>

        {/* East meeting rooms */}
        <RoundTable cx={1812} cy={846} r={44} seats={6} />
        <g className="fp-furniture">
          <rect x={1762} y={588} width={34} height={92} />
        </g>

        {/* Boardroom */}
        <g className="fp-furniture">
          <rect x={1832} y={986} width={226} height={92} rx={44} />
        </g>
        <g className="fp-seat">
          {[1870, 1920, 1970, 2020].map((x) => (
            <Chair key={`bt${x}`} cx={x} cy={962} r={15} rot={180} />
          ))}
          {[1870, 1920, 1970, 2020].map((x) => (
            <Chair key={`bb${x}`} cx={x} cy={1102} r={15} rot={0} />
          ))}
          <Chair cx={1804} cy={1032} r={15} rot={-90} />
          <Chair cx={2086} cy={1032} r={15} rot={90} />
        </g>

        {/* West team bays + high workpoints */}
        <g className="fp-furniture">
          {[626, 809, 1010].map((y) => (
            <g key={`bay${y}`}>
              <rect x={113} y={y} width={410} height={82} />
              <line x1={113} y1={y + 41} x2={523} y2={y + 41} />
              {Array.from({ length: 6 }, (_, i) => (
                <line
                  key={i} x1={113 + ((i + 1) * 410) / 7} y1={y}
                  x2={113 + ((i + 1) * 410) / 7} y2={y + 41}
                />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line
                  key={`b${i}`} x1={113 + ((i + 1) * 410) / 6} y1={y + 41}
                  x2={113 + ((i + 1) * 410) / 6} y2={y + 82}
                />
              ))}
            </g>
          ))}
          <rect x={105} y={464} width={425} height={42} />
        </g>

        {/* South workstation banks: 6 × 6 individually bookable desks */}
        {DESK_BANK_ORIGINS.map(([ox, oy], b) => (
          <g key={`bank${b}`}>
            {[0, 1, 2].map((row) =>
              [0, 1].map((col) => {
                const x = ox + col * DESK_W;
                const y = oy + row * DESK_H;
                return (
                  <g key={`${row}-${col}`}>
                    <Desk x={x} y={y} w={DESK_W} h={DESK_H} />
                    <g className="fp-seat">
                      <Chair
                        cx={col === 0 ? x - 15 : x + DESK_W + 15}
                        cy={y + DESK_H / 2}
                        r={12}
                        rot={col === 0 ? -90 : 90}
                      />
                    </g>
                  </g>
                );
              }),
            )}
          </g>
        ))}

        {/* Lounge pod banquette rings */}
        {[POD_N, POD_S].map((p, i) => (
          <polygon key={`pod${i}`} points={poly(octagonPoints(p.cx, p.cy, p.r - 26))} className="fp-pod-inner" />
        ))}

        {/* Sofas beside meeting rooms A + B */}
        <g className="fp-lounge">
          {LOUNGE_SOFAS.map((s, i) => (
            <Sofa key={`sofa${i}`} x={s.x} y={s.y} w={s.w} h={s.h} />
          ))}
        </g>

        {/* Washroom fixtures */}
        <g className="fp-furniture">
          {[552, 610, 668, 726, 788].map((y) => (
            <rect key={`wc${y}`} x={2078} y={y} width={28} height={34} rx={9} />
          ))}
          <rect x={2016} y={848} width={30} height={38} rx={10} />
          <rect x={2062} y={846} width={48} height={64} />
          <line x1={1900} y1={840} x2={1996} y2={840} />
        </g>

        <Stairs x={150} y={1276} w={300} h={78} steps={9} />
        <Stairs x={1790} y={1216} w={300} h={136} steps={11} />

        {PLANTS.map(([x, y], i) => (
          <Plant key={`pl${i}`} cx={x} cy={y} r={i >= 14 ? 30 : 20} />
        ))}
      </g>

      {/* ── #poche + #fixtures ────────────────────────────────────────────── */}
      <g className="fp-glazing">
        {GLAZING.map(([x1, y1, x2, y2], i) => (
          <line key={`gl${i}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {WALLS.map((wall, i) => (
        <line
          key={`w${i}`}
          className={`fp-wall fp-wall-${wall.c}`}
          x1={wall.l[0]} y1={wall.l[1]} x2={wall.l[2]} y2={wall.l[3]}
        />
      ))}
      <g className="fp-column">
        {COLUMNS.map(([x, y], i) => (
          <rect key={`c${i}`} x={x - 11} y={y - 11} width={22} height={22} />
        ))}
      </g>
      {DOORS.map((dr, i) => (
        <Door key={`d${i}`} x={dr.x} y={dr.y} r={dr.r} a={dr.a} dir={dr.dir} />
      ))}

      {/* ── Fixed drawing annotations ─────────────────────────────────────── */}
      {PLAN_LABELS.map((l, i) => (
        <text
          key={`t${i}`}
          x={l.x}
          y={l.y}
          className={`fp-annotation fp-annotation-${l.tone ?? 'ink'}`}
          textAnchor={l.anchor ?? 'middle'}
          fontSize={l.size ?? 22}
          fontWeight={l.weight ?? 600}
          transform={l.rotate ? `rotate(${l.rotate} ${l.x} ${l.y})` : undefined}
        >
          {l.text}
        </text>
      ))}
    </g>
  );
});
