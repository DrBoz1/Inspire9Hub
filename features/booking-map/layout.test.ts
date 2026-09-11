import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMPACT_BELOW,
  MIN_PLAN_W,
  RAIL_W,
  SIDEBAR_W,
  computeLayout,
  planWidth,
  toggleSidebar,
  type LayoutState,
} from './layout';

const S = (o: Partial<LayoutState> = {}): LayoutState => ({
  sidebarOpen: true,
  panelOpen: false,
  overlayRequested: false,
  ...o,
});

/** Width the map really gets inside the dashboard at a given browser width:
 *  16rem dashboard sidebar, p-8 on <main>, 1px border either side of the card. */
const inDashboard = (viewport: number) => viewport - 256 - 64 - 2;

describe('the invariant: the plan is never squeezed', () => {
  it('keeps at least MIN_PLAN_W for the plan at every non-compact width and state', () => {
    const failures: string[] = [];
    for (let w = COMPACT_BELOW; w <= 2600; w++) {
      for (const sidebarOpen of [true, false])
        for (const panelOpen of [true, false])
          for (const overlayRequested of [true, false]) {
            const l = computeLayout(w, { sidebarOpen, panelOpen, overlayRequested });
            const p = planWidth(w, l);
            if (p < MIN_PLAN_W) failures.push(`w=${w} ${JSON.stringify({ sidebarOpen, panelOpen, overlayRequested })} -> plan ${p}`);
          }
    }
    expect(failures.slice(0, 5), `${failures.length} layouts squeeze the plan`).toEqual([]);
  });

  it('never lays out columns wider than the space available', () => {
    for (let w = COMPACT_BELOW; w <= 2600; w += 7) {
      const l = computeLayout(w, S({ panelOpen: true }));
      const used = (l.sidebar === 'column' ? SIDEBAR_W : 0) + (l.panel === 'rail' ? RAIL_W : 0);
      expect(used, `w=${w}`).toBeLessThanOrEqual(w - MIN_PLAN_W);
    }
  });
});

describe('the bug you hit', () => {
  it('at a 1366px window with a space selected, hides the list instead of clipping the rail', () => {
    const w = inDashboard(1366); // 1044
    const l = computeLayout(w, S({ panelOpen: true }));
    expect(l.panel).toBe('rail');
    expect(l.sidebar).toBe('hidden');
    expect(planWidth(w, l)).toBeGreaterThanOrEqual(MIN_PLAN_W);
  });

  it('brings the list back as soon as the panel closes', () => {
    expect(computeLayout(inDashboard(1366), S({ panelOpen: false })).sidebar).toBe('column');
  });

  it.each([
    [1280, 'hidden'],
    [1366, 'hidden'],
    [1440, 'hidden'],
    [1536, 'column'],
    [1920, 'column'],
  ])('with a space open at a %ipx window the list is %s', (vp, expected) => {
    expect(computeLayout(inDashboard(vp), S({ panelOpen: true })).sidebar).toBe(expected);
  });
});

describe('compact mode', () => {
  it('switches below COMPACT_BELOW and not at it', () => {
    expect(computeLayout(COMPACT_BELOW - 1, S()).compact).toBe(true);
    expect(computeLayout(COMPACT_BELOW, S()).compact).toBe(false);
  });

  it('turns the panel into a sheet and never shows a sidebar column', () => {
    const l = computeLayout(390, S({ panelOpen: true, overlayRequested: true }));
    expect(l).toEqual({ compact: true, sidebar: 'hidden', panel: 'sheet', floatLegend: false });
  });

  it('is decided by the map width, not the window', () => {
    // A 1100px window is "desktop" to matchMedia, but the map only gets 778px.
    expect(computeLayout(inDashboard(1100), S()).compact).toBe(true);
  });
});

describe('overlay', () => {
  it('only appears when explicitly asked for', () => {
    const w = inDashboard(1366);
    expect(computeLayout(w, S({ panelOpen: true, overlayRequested: false })).sidebar).toBe('hidden');
    expect(computeLayout(w, S({ panelOpen: true, overlayRequested: true })).sidebar).toBe('overlay');
  });

  it('is never used when a column fits', () => {
    expect(computeLayout(1600, S({ panelOpen: true, overlayRequested: true })).sidebar).toBe('column');
  });
});

describe('the legend', () => {
  it('floats only when no sidebar is carrying it', () => {
    expect(computeLayout(1600, S()).floatLegend).toBe(false);
    expect(computeLayout(1600, S({ sidebarOpen: false })).floatLegend).toBe(true);
    expect(computeLayout(1044, S({ panelOpen: true, overlayRequested: true })).floatLegend).toBe(false);
    expect(computeLayout(500, S()).floatLegend).toBe(false);
  });
});

describe('the sidebar toggle', () => {
  it('closes a visible column', () => {
    expect(toggleSidebar(1600, S())).toEqual({ sidebarOpen: false, overlayRequested: false });
  });

  it('reopens as a column when there is room, without requesting an overlay', () => {
    expect(toggleSidebar(1600, S({ sidebarOpen: false }))).toEqual({ sidebarOpen: true, overlayRequested: false });
  });

  it('opens as an overlay when a panel leaves no room for a column', () => {
    const w = inDashboard(1366);
    const next = toggleSidebar(w, S({ sidebarOpen: true, panelOpen: true }));
    expect(next).toEqual({ sidebarOpen: true, overlayRequested: true });
    expect(computeLayout(w, { ...S({ panelOpen: true }), ...next }).sidebar).toBe('overlay');
  });

  it('closes an overlay', () => {
    expect(toggleSidebar(1044, S({ panelOpen: true, overlayRequested: true }))).toEqual({
      sidebarOpen: false,
      overlayRequested: false,
    });
  });

  it('does nothing in compact mode', () => {
    const s = S({ sidebarOpen: false });
    expect(toggleSidebar(500, s)).toEqual({ sidebarOpen: false, overlayRequested: false });
  });
});

describe('constants match the CSS they describe', () => {
  const read = (f: string) => readFileSync(join(import.meta.dirname, f), 'utf8');

  it('SIDEBAR_W is the Sidebar width', () => {
    expect(SIDEBAR_W).toBe(320);
    expect(read('components/Sidebar.tsx')).toMatch(/className="flex h-full w-80 shrink-0/);
  });

  it('RAIL_W is the BookingPanel rail width', () => {
    expect(read('components/BookingPanel.tsx')).toContain(`w-[${RAIL_W}px]`);
  });
});
