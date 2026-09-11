/**
 * Layout decisions for the booking map, made from the width it actually has.
 *
 * The standalone app decided this with `matchMedia('(max-width: 1023px)')` -- the
 * width of the browser window. That was fine full-screen. Inside the dashboard the
 * map loses 256px to the dashboard sidebar and 64px to padding, so at a 1366px
 * window it believed it had 1366px, laid out sidebar (320) + plan + booking rail
 * (380), and the rail was clipped off the right edge. Collapsing the sidebar was
 * the only way to see it.
 *
 * Everything here is a pure function of (width, state). That is deliberate: the
 * invariant that matters -- the plan never gets narrower than MIN_PLAN_W, so
 * nothing is squeezed off-screen -- can then be checked for every width in tests
 * rather than eyeballed at three.
 */

/** Must match the Sidebar's `w-80`. A test reads the component to enforce it. */
export const SIDEBAR_W = 320;
/** Must match the BookingPanel rail's `w-[380px]`. Also enforced by test. */
export const RAIL_W = 380;
/** Narrowest the plan stays legible: room labels start colliding below this. */
export const MIN_PLAN_W = 440;
/** Below this even rail + plan won't fit side by side, so the panel becomes a
 *  bottom sheet and the list a drawer. */
export const COMPACT_BELOW = RAIL_W + MIN_PLAN_W;

export type SidebarMode = 'column' | 'overlay' | 'hidden';

export interface LayoutState {
  /** The member's preference: do they want the space list shown? */
  sidebarOpen: boolean;
  /** A space is selected, so the booking panel is showing. */
  panelOpen: boolean;
  /** They explicitly asked for the list while there's no room for it as a column. */
  overlayRequested: boolean;
}

export interface Layout {
  compact: boolean;
  sidebar: SidebarMode;
  panel: 'rail' | 'sheet' | 'none';
  /** The legend floats over the plan only when no sidebar is carrying it. */
  floatLegend: boolean;
}

export function computeLayout(width: number, s: LayoutState): Layout {
  if (width < COMPACT_BELOW) {
    return { compact: true, sidebar: 'hidden', panel: s.panelOpen ? 'sheet' : 'none', floatLegend: false };
  }

  const fitsAsColumn = width >= SIDEBAR_W + MIN_PLAN_W + (s.panelOpen ? RAIL_W : 0);

  // Opening a space when the list can't fit beside it hides the list rather than
  // floating it over the plan -- the member just clicked *on the plan*, and covering
  // it would be the worst possible response. Their preference is untouched, so the
  // list comes back when the panel closes. It only floats if they explicitly ask.
  const sidebar: SidebarMode = !s.sidebarOpen
    ? 'hidden'
    : fitsAsColumn
      ? 'column'
      : s.overlayRequested
        ? 'overlay'
        : 'hidden';

  return {
    compact: false,
    sidebar,
    panel: s.panelOpen ? 'rail' : 'none',
    floatLegend: sidebar === 'hidden',
  };
}

/** What the sidebar toggle does from the current state. */
export function toggleSidebar(
  width: number,
  s: LayoutState,
): Pick<LayoutState, 'sidebarOpen' | 'overlayRequested'> {
  const now = computeLayout(width, s);
  // The toggle isn't shown in compact mode; if it's ever invoked there, change
  // nothing rather than leave a stale overlay request to surface on resize.
  if (now.compact) return { sidebarOpen: s.sidebarOpen, overlayRequested: s.overlayRequested };
  if (now.sidebar !== 'hidden') return { sidebarOpen: false, overlayRequested: false };

  const asColumn =
    computeLayout(width, { ...s, sidebarOpen: true, overlayRequested: false }).sidebar === 'column';
  return { sidebarOpen: true, overlayRequested: !asColumn };
}

/** Width left for the plan. An overlay floats, so it doesn't take from it. */
export function planWidth(width: number, l: Layout): number {
  if (l.compact) return width;
  return width - (l.sidebar === 'column' ? SIDEBAR_W : 0) - (l.panel === 'rail' ? RAIL_W : 0);
}
