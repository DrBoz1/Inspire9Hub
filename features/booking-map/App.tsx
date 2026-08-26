'use client';

// The map drives ResizeObserver, matchMedia, pointer events and localStorage,
// so it can only run in the browser.
import './floorplan.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List, Maximize2, Minus, Plus, X } from 'lucide-react';
import type { Availability, Booking, Space } from './booking/types';
import { SPACES } from './data/spaces';
import { generateBookings } from './data/seedBookings';
import { addDays } from './booking/time';
import {
  availabilityOf, bookingsOnDay, DAY_END, formatDateLong, formatRange, formatTime, freeGaps,
  isClosed, makeISO, nextAvailableStart, nowMinutes, openingFor, SLOT, todayKey, validateBooking,
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
import { useMediaQuery } from './useMediaQuery';

const MEMBER = 'Hesam';
const STORE_KEY = 'i9.bookings.v1';

interface Persisted {
  mine: Booking[];
  cancelled: string[];
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (Array.isArray(p.mine) && Array.isArray(p.cancelled)) return p;
    }
  } catch {
    /* storage unavailable or corrupt — start clean */
  }
  return { mine: [], cancelled: [] };
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

export default function App() {
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

  /** Below 1024 px the sidebar becomes a drawer and the panel a bottom sheet. */
  const compact = useMediaQuery('(max-width: 1023px)');

  const [persisted, setPersisted] = useState<Persisted>(loadPersisted);
  const seed = useMemo(() => generateBookings(), []);
  const cameraRef = useRef<Camera | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(persisted));
    } catch {
      /* ignore — bookings still live in memory for this session */
    }
  }, [persisted]);

  const bookings = useMemo(() => {
    const cancelled = new Set(persisted.cancelled);
    return [...seed, ...persisted.mine].filter((b) => !cancelled.has(b.id));
  }, [persisted, seed]);

  // ── availability for the selected window ─────────────────────────────────
  const win = useMemo(() => ({ date, from, to }), [date, from, to]);

  const status = useMemo(() => {
    const m = new Map<string, Availability>();
    for (const s of SPACES) m.set(s.id, availabilityOf(s, bookings, win));
    return m;
  }, [bookings, win]);

  const subline = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of SPACES) {
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
  }, [bookings, date, from, status, to, win]);

  const ariaLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of SPACES) {
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
  }, [from, status, subline, to]);

  // ── filtering ────────────────────────────────────────────────────────────
  const matching = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return SPACES.filter((s) => {
      if (filters.groups.length && !filters.groups.includes(s.group)) return false;
      if (filters.minCapacity > 0 && s.capacity < filters.minCapacity) return false;
      if (filters.amenities.length && !filters.amenities.every((a) => s.amenities.includes(a))) return false;
      if (q) {
        const hay = `${s.name} ${s.code} ${s.zone} ${s.description} ${s.amenities.join(' ')} ${KIND_META[s.kind].label}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [filters]);

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

  const selected = selectedId ? SPACES.find((s) => s.id === selectedId) ?? null : null;

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

  const book = useCallback(
    (space: Space, title: string) => {
      const err = validateBooking(space, bookings, { date, from, to });
      if (err) {
        setAnnouncement(err.message);
        return;
      }
      const booking: Booking = {
        id: `mine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        spaceId: space.id,
        start: makeISO(date, from),
        end: makeISO(date, to),
        title,
        owner: MEMBER,
        mine: true,
      };
      setPersisted((p) => ({ ...p, mine: [...p.mine, booking] }));
      setJustBooked(booking);
      setAnnouncement(`Booked. ${space.name}, ${formatRange(from, to)}.`);
    },
    [bookings, date, from, to],
  );

  const cancel = useCallback((id: string) => {
    setPersisted((p) => ({
      mine: p.mine.filter((b) => b.id !== id),
      cancelled: p.cancelled.includes(id) ? p.cancelled : [...p.cancelled, id],
    }));
    setJustBooked(null);
    setAnnouncement('Booking cancelled.');
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

  return (
    // Two scopes on purpose. The outer div is plain hub styling, so TopBar's
    // shadcn controls resolve the hub's tokens and Poppins. .fp-root starts below
    // it, where --color-border, --font-sans and the rest become the drawing's.
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-slate-900">
      <TopBar
        date={date}
        onDateChange={changeDate}
        view={view}
        onViewChange={changeView}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
      />
      <div className="fp-root flex min-h-0 flex-1 flex-col">
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
          <>
            <span className="tnum font-semibold" style={{ color: 'var(--color-status-available-ink)' }}>
              {counts.available}
            </span>{' '}
            available
          </>
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

      <div className="flex min-h-0 flex-1">
        {!compact && sidebarOpen && (
        <Sidebar
          spaces={SPACES}
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
          footer={<Legend
              counts={counts}
              hidden={hiddenStatuses}
              onToggle={(s) =>
                setHiddenStatuses((h) => (h.includes(s) ? h.filter((x) => x !== s) : [...h, s]))
              }
            />}
        />
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
                    spaces={SPACES}
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
                      compact || sidebarOpen ? 'hidden' : ''
                    }`}
                  >
                    <Legend
                      counts={counts}
                      hidden={hiddenStatuses}
                      onToggle={(s) =>
                        setHiddenStatuses((h) => (h.includes(s) ? h.filter((x) => x !== s) : [...h, s]))
                      }
                    />
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

        {selected && !compact && (
          <BookingPanel
            space={selected}
            status={selected.bookable ? status.get(selected.id) ?? 'available' : 'closed'}
            date={date}
            from={from}
            to={to}
            bookings={bookings}
            memberName={MEMBER}
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
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0"
            style={{ background: 'rgb(16 24 32 / .35)' }}
            onClick={() => setListOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full max-w-[86vw]">
            <Sidebar
              spaces={SPACES}
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
            />
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
          className="fixed bottom-4 left-4 z-30 flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-white"
          style={{ background: 'var(--color-brand)', boxShadow: 'var(--shadow-e3)' }}
        >
          <List size={16} aria-hidden />
          {matching.filter((s) => s.bookable).length} spaces
        </button>
      )}

      {compact && selected && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
          <BookingPanel
            variant="sheet"
            space={selected}
            status={selected.bookable ? status.get(selected.id) ?? 'available' : 'closed'}
            date={date}
            from={from}
            to={to}
            bookings={bookings}
            memberName={MEMBER}
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
    </div>
  );
}
