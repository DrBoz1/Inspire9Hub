'use client';

// The map measures itself with ResizeObserver and runs on pointer events,
// so it can only run in the browser.
import './floorplan.css';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { List, Maximize2, Minus, Plus, X } from 'lucide-react';
import type { Availability, Booking, Space } from './booking/types';
import { SPACES } from './data/spaces';
import { mergeSpaces, planIdByWorkspace, toMapBookings, type DayBookingRow, type WorkspaceRow } from './adapter';
import { getMapDay } from './actions';
import { HUB_TIMEZONE } from '@/lib/datetime';
import { addDays } from './booking/time';
import {
  availabilityOf, bookingsOnDay, DAY_END, formatDateLong, formatRange, formatTime, freeGaps,
  isClosed, nextAvailableStart, nowMinutes, openingFor, SLOT, todayKey,
} from './booking/time';
import { FloorPlan, type Camera } from './floorplan/FloorPlan';
import { TopBar, type ViewMode } from './components/TopBar';
import { TimeRail } from './components/TimeRail';
import { Sidebar, EMPTY_FILTERS, type Filters } from './components/Sidebar';
import { BookingPanel } from './components/BookingPanel';
import { Legend } from './components/Legend';
import { ScheduleView } from './components/ScheduleView';
import { STATUS_LABEL } from './components/ui';
import { KIND_META } from './data/spaces';
import { computeLayout, toggleSidebar as nextSidebar } from './layout';
import { useElementWidth } from './useElementWidth';

export interface MapProps {
  /** `workspaces` rows as the page loaded them. May predate the floor-plan columns. */
  workspaces: WorkspaceRow[];
  /** Shown as "Booking as ...". */
  memberName: string;
  /** Set when the rooms themselves couldn't be loaded. */
  roomsError: string | null;
}

/** A one-line strip under the time rail: something the member should know. */
function Notice({
  tone = 'info',
  children,
  action,
}: {
  tone?: 'info' | 'danger';
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className="flex shrink-0 items-center gap-2 px-4 py-1.5 text-[13px]"
      style={
        tone === 'danger'
          ? { background: 'var(--color-danger-wash)', color: 'var(--color-danger-ink)' }
          : { background: 'var(--color-surface-2)', color: 'var(--color-ink-600)' }
      }
    >
      <span className="min-w-0 flex-1">{children}</span>
      {action && (
        <button onClick={action.onClick} className="shrink-0 rounded px-2 py-0.5 font-semibold underline">
          {action.label}
        </button>
      )}
    </div>
  );
}

/** First day strictly after `date` that Inspire9 is open. */
function nextOpenDay(date: string): string {
  let d = date;
  for (let i = 0; i < 8; i++) {
    d = addDays(d, 1);
    if (!isClosed(d)) return d;
  }
  return date;
}

/**
 * Where the app opens. Landing on a closed day — a Sunday, or after the doors
 * have shut for the evening — would show a map with nothing bookable on it, so
 * we roll forward to the next day you can actually book.
 */
function initialDate(): string {
  const today = todayKey();
  const h = openingFor(today);
  if (h.close === null || nowMinutes() >= h.close - 30) return nextOpenDay(today);
  return today;
}

/** Default window: the next whole hour that is inside opening hours. */
function defaultWindow(date: string): [number, number] {
  const h = openingFor(date);
  const open = h.open ?? 9 * 60;
  const close = h.close ?? 17 * 60;
  const base = date === todayKey() ? Math.max(open, Math.ceil(nowMinutes() / 60) * 60) : Math.max(open, 10 * 60);
  const from = Math.min(base, close - 60);
  return [from, Math.min(from + 60, close)];
}

export default function App({ workspaces, memberName, roomsError }: MapProps) {
  const [date, setDate] = useState(initialDate);
  const [[from, to], setWindow] = useState<[number, number]>(() => defaultWindow(initialDate()));
  const [view, setView] = useState<ViewMode>('map');
  // The schedule already names every space down its left edge, so the sidebar is a
  // second copy of the same list eating the width the grid needs. Collapse it when
  // switching to schedule, restore it for the map -- still manually togglable, so
  // the filters stay reachable in either view.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const changeView = useCallback((v: ViewMode) => {
    setView(v);
    setSidebarOpen(v === 'map');
  }, []);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [hiddenStatuses, setHiddenStatuses] = useState<Availability[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [justBooked, setJustBooked] = useState<Booking | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [listOpen, setListOpen] = useState(false);

  // Layout comes from the map's own width, not the window's. Inside the dashboard
  // the map loses 320px to the dashboard's sidebar and padding, which a window
  // media query can't see -- that is how the booking rail ended up clipped.
  const [rootRef, width] = useElementWidth<HTMLDivElement>();
  // Which space the member asked to float the list over. Keyed to the selection
  // rather than a boolean, so choosing another space or closing the panel
  // dismisses it without an effect.
  const [overlayFor, setOverlayFor] = useState<string | null>(null);
  const layoutState = {
    sidebarOpen,
    panelOpen: selectedId !== null,
    overlayRequested: overlayFor !== null && overlayFor === selectedId,
  };
  const layout = computeLayout(width ?? 0, layoutState);
  const compact = layout.compact;

  const cameraRef = useRef<Camera | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // The drawing, joined to the rooms admins have set up. See adapter.ts.
  const { spaces, linkedCount, problems } = useMemo(() => mergeSpaces(SPACES, workspaces), [workspaces]);
  useEffect(() => {
    if (problems.length) console.warn('[floor plan] data problems:\n' + problems.join('\n'));
  }, [problems]);

  // Real bookings, one hub-local day at a time. Each result records the date it
  // belongs to, so a slow response for Tuesday can never overwrite Wednesday's
  // after the member has moved on: a result for any other date is ignored.
  type DayState = { for: string; rows: DayBookingRow[] } | { for: string; error: string };
  const [dayData, setDayData] = useState<DayState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let live = true;
    getMapDay(date).then(
      (r) => {
        if (live) setDayData(r.ok ? { for: r.day, rows: r.rows } : { for: r.day, error: r.error });
      },
      () => {
        if (live) setDayData({ for: date, error: 'Couldn’t reach the server. Check your connection and try again.' });
      },
    );
    return () => {
      live = false;
    };
  }, [date, reloadKey]);

  const current = dayData && dayData.for === date ? dayData : null;
  const loading = current === null;
  const dayError = current && 'error' in current ? current.error : null;
  const bookings = useMemo(
    () =>
      current && 'rows' in current
        ? toMapBookings(current.rows, date, HUB_TIMEZONE, planIdByWorkspace(spaces)).bookings
        : [],
    [current, date, spaces],
  );

  // ── availability for the selected window ─────────────────────────────────
  const win = useMemo(() => ({ date, from, to }), [date, from, to]);

  const status = useMemo(() => {
    const m = new Map<string, Availability>();
    for (const s of spaces) m.set(s.id, availabilityOf(s, bookings, win));
    return m;
  }, [bookings, spaces, win]);

  const subline = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of spaces) {
      if (!s.bookable) continue;
      const st = status.get(s.id)!;
      const day = bookingsOnDay(bookings, s.id, date);
      if (st === 'mine') {
        m.set(s.id, 'Your booking');
      } else if (st === 'available') {
        const next = day.find((b) => b.from >= to);
        m.set(s.id, next ? `Free until ${formatTime(next.from)}` : 'Free all day');
      } else if (st === 'partial') {
        const gaps = freeGaps(bookings, s.id, win);
        const g = gaps.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a), gaps[0]);
        m.set(s.id, g ? `Free ${formatRange(g.from, g.to)}` : 'Partly booked');
      } else if (st === 'booked') {
        const next = nextAvailableStart(s, bookings, date, to - from, to);
        m.set(s.id, next !== null ? `Next free ${formatTime(next)}` : 'Booked all day');
      } else {
        m.set(s.id, 'Closed');
      }
    }
    return m;
  }, [bookings, date, from, spaces, status, to, win]);

  const ariaLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of spaces) {
      if (!s.bookable) {
        m.set(s.id, `${s.name}. ${KIND_META[s.kind].label}, not bookable. ${s.zone}.`);
        continue;
      }
      const st = status.get(s.id)!;
      m.set(
        s.id,
        `${s.name}. ${KIND_META[s.kind].label}, ${s.capacity} ${s.capacity === 1 ? 'person' : 'people'}. ` +
          `${STATUS_LABEL[st]} ${formatRange(from, to)}. ${subline.get(s.id) ?? ''} ${s.zone}. ` +
          `Press Enter to ${st === 'available' ? 'book' : 'see details'}.`,
      );
    }
    return m;
  }, [from, spaces, status, subline, to]);

  // ── filtering ────────────────────────────────────────────────────────────
  const matching = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return spaces.filter((s) => {
      if (filters.groups.length && !filters.groups.includes(s.group)) return false;
      if (filters.minCapacity > 0 && s.capacity < filters.minCapacity) return false;
      if (filters.amenities.length && !filters.amenities.every((a) => s.amenities.includes(a))) return false;
      if (q) {
        const hay = `${s.name} ${s.code} ${s.zone} ${s.description} ${s.amenities.join(' ')} ${KIND_META[s.kind].label}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [filters, spaces]);

  const visible = useMemo(() => {
    const set = new Set<string>();
    for (const s of matching) {
      const st = s.bookable ? status.get(s.id) ?? 'available' : 'closed';
      if (hiddenStatuses.includes(st)) continue;
      set.add(s.id);
    }
    return set;
  }, [hiddenStatuses, matching, status]);

  const counts = useMemo(() => {
    const c: Record<Availability, number> = { available: 0, partial: 0, booked: 0, mine: 0, closed: 0 };
    for (const s of matching) {
      const st = s.bookable ? status.get(s.id) ?? 'available' : 'closed';
      c[st] += 1;
    }
    return c;
  }, [matching, status]);

  const selected = selectedId ? spaces.find((s) => s.id === selectedId) ?? null : null;

  // ── handlers ─────────────────────────────────────────────────────────────
  const changeWindow = useCallback(
    (f: number, t: number) => {
      const h = openingFor(date);
      const lo = h.open ?? 0;
      const hi = h.close ?? DAY_END;
      setWindow([Math.max(lo, f), Math.min(hi, Math.max(f + SLOT, t))]);
      setJustBooked(null);
    },
    [date],
  );

  const changeDate = useCallback((d: string) => {
    setDate(d);
    setWindow(defaultWindow(d));
    setJustBooked(null);
  }, []);

  const jumpNow = useCallback(() => {
    const d = initialDate();
    setDate(d);
    setWindow(defaultWindow(d));
    setJustBooked(null);
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setJustBooked(null);
    setListOpen(false);
    cameraRef.current?.focus(id);
  }, []);

  // Booking from the plan is switched on in the next step, through the same server
  // action, Stripe checkout and overlap constraint as the Bookings page. Until then
  // the map is read-only rather than pretending: the standalone app "booked" into
  // localStorage, where nothing else could ever see it.
  const book = useCallback((space: Space) => {
    setAnnouncement(`Booking ${space.name} from the floor plan isn’t switched on yet. Use Bookings for now.`);
  }, []);
  const cancel = useCallback(() => {
    setAnnouncement('Manage your bookings from the Bookings page.');
  }, []);

  // ── global shortcuts (§7.3) ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === 'Escape') {
        if (selectedId) {
          setSelectedId(null);
          setJustBooked(null);
        }
        return;
      }
      if (typing) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'f') {
        e.preventDefault();
        setHiddenStatuses((h) =>
          h.length ? [] : (['partial', 'booked', 'closed'] as Availability[]),
        );
      } else if (e.key === '[') { e.preventDefault(); changeWindow(from - 30, to - 30); }
      else if (e.key === ']') { e.preventDefault(); changeWindow(from + 30, to + 30); }
      else if (e.key === 't') { e.preventDefault(); jumpNow(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [changeWindow, from, jumpNow, selectedId, to]);

  useEffect(() => {
    setAnnouncement(
      `${formatRange(from, to)}. ${counts.available} of ${matching.filter((s) => s.bookable).length} spaces available.`,
    );
  }, [counts.available, from, matching, to]);

  const mapLabel = `Inspire9 Level 1 floor plan, ${date}, ${formatRange(from, to)}`;

  // Rendered in up to three places (column, floating, compact drawer), so built once.
  const legendEl = (
    <Legend
      counts={counts}
      hidden={hiddenStatuses}
      onToggle={(s) =>
        setHiddenStatuses((h) => (h.includes(s) ? h.filter((x) => x !== s) : [...h, s]))
      }
    />
  );
  const sidebarEl = (
    <Sidebar
      spaces={spaces}
      matching={matching}
      status={status}
      subline={subline}
      filters={filters}
      onFilters={setFilters}
      selectedId={selectedId}
      hoveredId={hoveredId}
      onSelect={select}
      onHover={setHoveredId}
      searchRef={searchRef}
      footer={legendEl}
    />
  );

  const onToggleSidebar = () => {
    const next = nextSidebar(width ?? 0, layoutState);
    setSidebarOpen(next.sidebarOpen);
    setOverlayFor(next.overlayRequested ? selectedId : null);
  };

  return (
    // Two scopes on purpose. The outer div is plain hub styling, so TopBar's
    // shadcn controls resolve the hub's tokens and Poppins. .fp-root starts below
    // it, where --color-border, --font-sans and the rest become the drawing's.
    // `@container` so the bars' breakpoints track the map's width, like layout.ts.
    // Children wait for the first measurement rather than flash a wrong layout; the
    // root itself always renders so the ResizeObserver keeps a live element.
    <div
      ref={rootRef}
      data-map-root
      className="@container relative flex h-full w-full flex-col overflow-hidden bg-white dark:bg-slate-900"
    >
      {width !== null && (<>
      <TopBar
        date={date}
        onDateChange={changeDate}
        view={view}
        onViewChange={changeView}
        sidebarOpen={layout.sidebar !== 'hidden'}
        onToggleSidebar={onToggleSidebar}
        showSidebarToggle={!compact}
      />
      <div className="fp-root relative flex min-h-0 flex-1 flex-col">
      {/* Map only: ScheduleView draws its own hour axis, and two unaligned time
          scales for the same day is the single most confusing thing on screen. */}
      {view === 'map' && (
      <TimeRail
        date={date}
        from={from}
        to={to}
        onChange={changeWindow}
        onJumpNow={jumpNow}
        summary={
          loading ? (
            <span>Loading bookings…</span>
          ) : (
            <>
              <span className="tnum font-semibold" style={{ color: 'var(--color-status-available-ink)' }}>
                {counts.available}
              </span>{' '}
              available
            </>
          )
        }
      />
      )}

      {isClosed(date) && (
        <div
          className="flex shrink-0 items-center gap-2 px-4 py-1.5 text-[13px]"
          style={{ background: 'var(--color-warn-wash)', color: 'var(--color-warn-ink)' }}
          role="status"
        >
          <span className="font-semibold">Inspire9 is closed on {formatDateLong(date)}.</span>
          <span>Opening hours are Monday to Friday 7am – 9pm, Saturday 9am – 5pm.</span>
          <button
            onClick={() => changeDate(nextOpenDay(date))}
            className="ml-auto rounded px-2 py-0.5 font-semibold underline"
          >
            Go to the next open day
          </button>
        </div>
      )}

      {roomsError ? (
        <Notice tone="danger">{roomsError}</Notice>
      ) : linkedCount === 0 ? (
        <Notice>
          Rooms haven’t been placed on the floor plan yet, so nothing here can be booked.{' '}
          <a href="/bookings" className="font-semibold underline underline-offset-2">Book from Bookings</a>
        </Notice>
      ) : null}
      {dayError && (
        <Notice tone="danger" action={{ label: 'Try again', onClick: () => setReloadKey((n) => n + 1) }}>
          {dayError}
        </Notice>
      )}

      <div className="relative flex min-h-0 flex-1">
        {layout.sidebar === 'column' && sidebarEl}

        {layout.sidebar === 'overlay' && (
          <>
            {/* Asked for while a space is open and there's no room for a column:
                float it over the plan. A click outside dismisses it. */}
            <div
              className="absolute inset-0 z-20"
              style={{ background: 'rgb(16 24 32 / .18)' }}
              onClick={() => setOverlayFor(null)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 z-30 flex" style={{ boxShadow: 'var(--shadow-e4)' }}>
              {sidebarEl}
            </div>
          </>
        )}

        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden" style={{ background: 'var(--color-mat)' }}>
          {view === 'map' ? (
            <>
              {/* The sheet takes the plan's own aspect ratio, so the paper is a
                  sheet on a mat rather than a frame with the drawing stranded
                  in the middle of it. */}
              <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
                <div
                  className="w-full overflow-hidden"
                  style={{
                    aspectRatio: '211 / 136',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    background: 'var(--color-paper)',
                    borderRadius: 'var(--radius-sheet)',
                    boxShadow: 'var(--shadow-sheet)',
                  }}
                >
                  <FloorPlan
                    spaces={spaces}
                    status={status}
                    visible={visible}
                    selectedId={selectedId}
                    hoveredId={hoveredId}
                    subline={subline}
                    ariaLabels={ariaLabels}
                    mapLabel={mapLabel}
                    onSelect={select}
                    onHover={setHoveredId}
                    cameraRef={cameraRef}
                  />
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 p-3 sm:p-6">
                <div className="relative h-full w-full">
                  {/* Only float the legend when the sidebar isn't carrying it --
                      otherwise it sits on top of the drawing and collides with it. */}
                  <div
                    className={`pointer-events-auto absolute bottom-4 left-4 ${
                      layout.floatLegend ? '' : 'hidden'
                    }`}
                  >
                    {legendEl}
                  </div>
                  <div
                    className="pointer-events-auto absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-lg border"
                    style={{
                      background: 'var(--color-surface-0)',
                      borderColor: 'var(--color-border)',
                      boxShadow: 'var(--shadow-e1)',
                    }}
                  >
                    {([
                      ['Zoom in', Plus, () => cameraRef.current?.zoomIn()],
                      ['Zoom out', Minus, () => cameraRef.current?.zoomOut()],
                      ['Fit floor plan', Maximize2, () => cameraRef.current?.fit()],
                    ] as const).map(([label, Icon, fn], i) => (
                      <button
                        key={label}
                        onClick={fn}
                        aria-label={label}
                        title={label}
                        className="grid h-9 w-9 place-items-center hover:bg-[var(--color-surface-2)]"
                        style={{
                          color: 'var(--color-ink-600)',
                          borderTop: i ? '1px solid var(--color-border)' : undefined,
                        }}
                      >
                        <Icon size={15} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <ScheduleView
              spaces={matching}
              bookings={bookings}
              status={status}
              date={date}
              from={from}
              to={to}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={select}
              onHover={setHoveredId}
              onPickSlot={(spaceId, start) => {
                changeWindow(start, start + (to - from));
                setSelectedId(spaceId);
              }}
            />
          )}
        </main>

        {selected && layout.panel === 'rail' && (
          <BookingPanel
            space={selected}
            status={selected.bookable ? status.get(selected.id) ?? 'available' : 'closed'}
            date={date}
            from={from}
            to={to}
            bookings={bookings}
            memberName={memberName}
            bookingEnabled={false}
            onClose={() => {
              setSelectedId(null);
              setJustBooked(null);
            }}
            onChangeWindow={changeWindow}
            onBook={book}
            onCancel={cancel}
            justBooked={justBooked}
            onDismissConfirmation={() => setJustBooked(null)}
          />
        )}
      </div>

      {/* ── Narrow viewports: sidebar as a drawer, panel as a bottom sheet ── */}
      {compact && listOpen && (
        <div className="absolute inset-0 z-40 flex">
          <div
            className="absolute inset-0"
            style={{ background: 'rgb(16 24 32 / .35)' }}
            onClick={() => setListOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full max-w-[86%]">
            {sidebarEl}
            <button
              onClick={() => setListOpen(false)}
              aria-label="Close the space list"
              className="absolute right-2 top-2 rounded p-1.5"
              style={{ background: 'var(--color-surface-0)', color: 'var(--color-ink-600)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {compact && (
        <button
          onClick={() => setListOpen(true)}
          className="absolute bottom-4 left-4 z-30 flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-white"
          style={{ background: 'var(--color-brand)', boxShadow: 'var(--shadow-e3)' }}
        >
          <List size={16} aria-hidden />
          {matching.filter((s) => s.bookable).length} spaces
        </button>
      )}

      {compact && selected && (
        <div className="pointer-events-none absolute inset-x-0 top-14 bottom-0 z-40 flex items-end justify-center">
          <BookingPanel
            variant="sheet"
            space={selected}
            status={selected.bookable ? status.get(selected.id) ?? 'available' : 'closed'}
            date={date}
            from={from}
            to={to}
            bookings={bookings}
            memberName={memberName}
            bookingEnabled={false}
            onClose={() => {
              setSelectedId(null);
              setJustBooked(null);
            }}
            onChangeWindow={changeWindow}
            onBook={book}
            onCancel={cancel}
            justBooked={justBooked}
            onDismissConfirmation={() => setJustBooked(null)}
          />
        </div>
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      </div>
      </>)}
    </div>
  );
}
