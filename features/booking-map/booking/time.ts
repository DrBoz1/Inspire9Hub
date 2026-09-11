import type { Availability, Booking, OpeningHours, Space, TimeWindow } from './types';
import { HUB_TIMEZONE } from '@/lib/datetime';
import { addDaysToKey, minutesNowIn, todayIn, weekdayOfKey } from '../zoned-time';

/** Booking granularity, in minutes. */
export const SLOT = 15;

/** Inspire9 opening hours, indexed by JS day-of-week (0 = Sunday). */
export const OPENING: Record<number, OpeningHours> = {
  0: { open: null, close: null },
  1: { open: 7 * 60, close: 21 * 60 },
  2: { open: 7 * 60, close: 21 * 60 },
  3: { open: 7 * 60, close: 21 * 60 },
  4: { open: 7 * 60, close: 21 * 60 },
  5: { open: 7 * 60, close: 21 * 60 },
  6: { open: 9 * 60, close: 17 * 60 },
};

/** Widest window the schedule grid ever draws. */
export const DAY_START = 7 * 60;
export const DAY_END = 21 * 60;

// ─── date helpers (local time, no library) ───────────────────────────────────

export function toDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  return addDaysToKey(key, n);
}

/** Today in Melbourne -- not on whatever clock the browser happens to be set to. */
export function todayKey(): string {
  return todayIn(HUB_TIMEZONE);
}

/** Local minutes-from-midnight, snapped up to the next slot. */
/** Minutes past midnight in Melbourne, rounded up to the next slot. */
export function nowMinutes(): number {
  return Math.ceil(minutesNowIn(HUB_TIMEZONE) / SLOT) * SLOT;
}

export function openingFor(dateKey: string): OpeningHours {
  return OPENING[weekdayOfKey(dateKey)];
}

export function isClosed(dateKey: string): boolean {
  return openingFor(dateKey).open === null;
}

// ─── formatting ──────────────────────────────────────────────────────────────

export function formatTime(mins: number): string {
  const total = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 < 12 ? 'am' : 'pm';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h}${suffix}` : `${h}:${String(m).padStart(2, '0')}${suffix}`;
}

export function formatRange(from: number, to: number): string {
  return `${formatTime(from)} – ${formatTime(to)}`;
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr${h > 1 ? 's' : ''}`;
  return `${h} hr ${m} min`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateLong(key: string): string {
  const d = fromDateKey(key);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDateShort(key: string): string {
  const d = fromDateKey(key);
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()}`;
}

export function relativeDay(key: string): string | null {
  const t = todayKey();
  if (key === t) return 'Today';
  if (key === addDays(t, 1)) return 'Tomorrow';
  if (key === addDays(t, -1)) return 'Yesterday';
  return null;
}

// ─── booking maths ───────────────────────────────────────────────────────────

/** Split an ISO local datetime into a date key + minutes-from-midnight. */
export function splitISO(iso: string): { date: string; mins: number } {
  const [date, time = '00:00'] = iso.split('T');
  const [h, m] = time.split(':').map(Number);
  return { date, mins: h * 60 + m };
}

export function makeISO(date: string, mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface Interval { from: number; to: number }

export function overlaps(a: Interval, b: Interval): boolean {
  return a.from < b.to && b.from < a.to;
}

/** Bookings for one space on one day, sorted and normalised to minute intervals. */
export function bookingsOnDay(bookings: Booking[], spaceId: string, date: string): Array<Booking & Interval> {
  return bookings
    .filter((b) => b.spaceId === spaceId && splitISO(b.start).date === date)
    .map((b) => ({ ...b, from: splitISO(b.start).mins, to: splitISO(b.end).mins }))
    .sort((a, b) => a.from - b.from);
}

/** Merge overlapping intervals. */
function merge(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.from - b.from);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.from <= last.to) last.to = Math.max(last.to, iv.to);
    else out.push({ ...iv });
  }
  return out;
}

/** Free gaps inside `window` for one space. */
export function freeGaps(bookings: Booking[], spaceId: string, win: TimeWindow): Interval[] {
  const busy = merge(bookingsOnDay(bookings, spaceId, win.date));
  const gaps: Interval[] = [];
  let cursor = win.from;
  for (const b of busy) {
    if (b.to <= win.from || b.from >= win.to) continue;
    if (b.from > cursor) gaps.push({ from: cursor, to: Math.min(b.from, win.to) });
    cursor = Math.max(cursor, b.to);
  }
  if (cursor < win.to) gaps.push({ from: cursor, to: win.to });
  return gaps.filter((g) => g.to > g.from);
}

/**
 * How a space reads on the map for the selected window.
 * `partial` is reserved for windows that still contain a usable gap (>= 30 min),
 * which is what makes "book the free part instead" a sensible offer.
 */
export function availabilityOf(
  space: Space,
  bookings: Booking[],
  win: TimeWindow,
): Availability {
  if (!space.bookable) return 'closed';
  const hours = openingFor(win.date);
  if (hours.open === null || hours.close === null) return 'closed';
  if (win.to <= hours.open || win.from >= hours.close) return 'closed';

  const day = bookingsOnDay(bookings, space.id, win.date);
  const clashing = day.filter((b) => overlaps(b, win));
  if (clashing.some((b) => b.mine)) return 'mine';
  if (clashing.length === 0) return 'available';

  const gaps = freeGaps(bookings, space.id, win);
  const largest = gaps.reduce((m, g) => Math.max(m, g.to - g.from), 0);
  return largest >= 30 ? 'partial' : 'booked';
}

/** Earliest start on `date` that fits `duration` inside opening hours. */
export function nextAvailableStart(
  space: Space,
  bookings: Booking[],
  date: string,
  duration: number,
  after: number,
): number | null {
  const hours = openingFor(date);
  if (hours.open === null || hours.close === null) return null;
  const busy = merge(bookingsOnDay(bookings, space.id, date));
  let start = Math.max(after, hours.open);
  start = Math.ceil(start / SLOT) * SLOT;
  while (start + duration <= hours.close) {
    const candidate = { from: start, to: start + duration };
    const hit = busy.find((b) => overlaps(b, candidate));
    if (!hit) return start;
    start = Math.ceil(hit.to / SLOT) * SLOT;
  }
  return null;
}

export type BookingError =
  | { code: 'closed'; message: string }
  | { code: 'outside_hours'; message: string }
  | { code: 'too_short'; message: string }
  | { code: 'too_long'; message: string }
  | { code: 'conflict'; message: string; conflict: Booking }
  | { code: 'past'; message: string }
  | { code: 'inverted'; message: string };

/** Full server-side-style validation. Returns null when the booking is legal. */
export function validateBooking(
  space: Space,
  bookings: Booking[],
  win: TimeWindow,
): BookingError | null {
  const duration = win.to - win.from;
  if (duration <= 0) return { code: 'inverted', message: 'End time must be after the start time.' };

  const hours = openingFor(win.date);
  if (hours.open === null || hours.close === null) {
    return { code: 'closed', message: `Inspire9 is closed on ${formatDateLong(win.date)}.` };
  }
  if (win.from < hours.open || win.to > hours.close) {
    return {
      code: 'outside_hours',
      message: `${formatDateLong(win.date)} opening hours are ${formatTime(hours.open)} – ${formatTime(
        hours.close,
      )}. Adjust your times to fit.`,
    };
  }
  if (win.date === todayKey() && win.from < nowMinutes() - SLOT) {
    return { code: 'past', message: 'That start time has already passed. Pick a later slot.' };
  }
  if (space.minMinutes && duration < space.minMinutes) {
    return {
      code: 'too_short',
      message: `${space.name} has a ${formatDuration(space.minMinutes)} minimum booking.`,
    };
  }
  if (space.maxMinutes && duration > space.maxMinutes) {
    return {
      code: 'too_long',
      message: `${space.name} can be held for at most ${formatDuration(space.maxMinutes)} at a time.`,
    };
  }
  const clash = bookingsOnDay(bookings, space.id, win.date).find((b) => overlaps(b, win));
  if (clash) {
    return {
      code: 'conflict',
      message: `${space.name} is taken ${formatRange(splitISO(clash.start).mins, splitISO(clash.end).mins)} by ${
        clash.mine ? 'you' : clash.owner
      }.`,
      conflict: clash,
    };
  }
  return null;
}

export function clampToSlot(mins: number): number {
  return Math.round(mins / SLOT) * SLOT;
}
