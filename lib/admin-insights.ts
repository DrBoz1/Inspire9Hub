import { HUB_TIMEZONE } from "@/lib/datetime";
import { summarizePayments, type PaymentRow } from "@/lib/member-stats";
import { FULL_REFUND_HOURS, HALF_REFUND_HOURS } from "@/lib/refund-policy";
import { DAY_END, DAY_START, OPENING } from "@/features/booking-map/booking/time";
import { addDaysToKey, dayBoundsUtc, parseDateKey, todayIn, wallClockAt, wallClockToUtc, weekdayOfKey } from "@/features/booking-map/zoned-time";

/**
 * The maths behind /admin/insights. Pure: no React, no Supabase, and `now` is
 * always passed in, so every number on that page can be pinned by a test.
 *
 * Time is measured as real elapsed milliseconds and cut up by the Melbourne wall
 * clock. A booking lands on the day and hour a member would say it happened, and
 * a 23- or 25-hour daylight-saving day is measured as the length it really was.
 *
 * Utilisation is booked time over SELLABLE time, and sellable time comes from
 * OPENING, the same table the floor plan and booking form use. A percentage
 * against any other denominator would be a number that only looks like a fact.
 */

// ─── Ranges ──────────────────────────────────────────────────────────────────

export type RangeKey = "7d" | "30d" | "90d" | "month" | "last-month";

/** Inclusive hub-day keys, plus the matching half-open UTC instants for queries. */
export type DayWindow = { startKey: string; endKey: string; startUTC: string; endUTC: string };

export type InsightRange = DayWindow & {
  key: RangeKey;
  label: string;
  days: number;
  /** The same number of days immediately before, for "vs previous period". */
  previous: DayWindow;
};

export const RANGE_KEYS: RangeKey[] = ["7d", "30d", "90d", "month", "last-month"];
export const DEFAULT_RANGE: RangeKey = "30d";

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month: "This month",
  "last-month": "Last month",
};

export const isRangeKey = (value: unknown): value is RangeKey => typeof value === "string" && (RANGE_KEYS as string[]).includes(value);

export function daysBetweenKeys(from: string, to: string): number {
  const [y1, m1, d1] = parseDateKey(from);
  const [y2, m2, d2] = parseDateKey(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function dayKeys(startKey: string, endKey: string): string[] {
  const span = daysBetweenKeys(startKey, endKey);
  return Array.from({ length: Math.max(0, span + 1) }, (_, i) => addDaysToKey(startKey, i));
}

export function dayWindow(startKey: string, endKey: string): DayWindow {
  return {
    startKey,
    endKey,
    startUTC: new Date(dayBoundsUtc(startKey, HUB_TIMEZONE).start).toISOString(),
    endUTC: new Date(dayBoundsUtc(endKey, HUB_TIMEZONE).end).toISOString(),
  };
}

/** A named range ending today in Melbourne. Anything unrecognised falls back to the last 30 days. */
export function resolveRange(key: unknown, now: Date): InsightRange {
  const k = isRangeKey(key) ? key : DEFAULT_RANGE;
  const today = todayIn(HUB_TIMEZONE, now.getTime());
  let startKey: string;
  let endKey = today;
  if (k === "month") {
    startKey = `${today.slice(0, 7)}-01`;
  } else if (k === "last-month") {
    endKey = addDaysToKey(`${today.slice(0, 7)}-01`, -1);
    startKey = `${endKey.slice(0, 7)}-01`;
  } else {
    startKey = addDaysToKey(today, -(Number.parseInt(k, 10) - 1));
  }
  const days = daysBetweenKeys(startKey, endKey) + 1;
  const previousEnd = addDaysToKey(startKey, -1);
  return {
    key: k,
    label: RANGE_LABELS[k],
    days,
    ...dayWindow(startKey, endKey),
    previous: dayWindow(addDaysToKey(previousEnd, -(days - 1)), previousEnd),
  };
}

export function rangePresets(now: Date): InsightRange[] {
  return RANGE_KEYS.map((k) => resolveRange(k, now));
}

// ─── Opening hours as real time ──────────────────────────────────────────────

/** One open day, as real instants. */
export type OpenWindow = { day: string; weekday: number; open: number; close: number };

/** When the hub is open on each day of a range. Closed days are simply absent. */
export function openWindows(startKey: string, endKey: string): OpenWindow[] {
  return dayKeys(startKey, endKey).flatMap((day) => {
    const weekday = weekdayOfKey(day);
    const { open, close } = OPENING[weekday];
    if (open === null || close === null) return [];
    return [{ day, weekday, open: wallClockToUtc(day, open, HUB_TIMEZONE), close: wallClockToUtc(day, close, HUB_TIMEZONE) }];
  });
}

/** Sellable minutes for ONE space across the given open days. */
export function sellableMinutes(windows: OpenWindow[]): number {
  return windows.reduce((sum, w) => sum + (w.close - w.open) / 60_000, 0);
}

const overlapMs = (aStart: number, aEnd: number, bStart: number, bEnd: number) => Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

/** No real booking runs this long; a row that claims to is bad data, and shouldn't turn a report into a long loop. */
const MAX_BOOKING_DAYS = 31;

/** The hub days a span of time touches. The end is exclusive, like the database's own ranges. */
function daysTouched(start: number, end: number): string[] {
  if (end <= start) return [];
  const first = wallClockAt(start, HUB_TIMEZONE).date;
  const last = wallClockAt(end - 1, HUB_TIMEZONE).date;
  if (daysBetweenKeys(first, last) > MAX_BOOKING_DAYS) return [];
  return dayKeys(first, last);
}

/** Minutes of a span that fall inside opening hours, summed over every day it touches. */
export function openMinutes(span: { start: number; end: number }, windowsByDay: Map<string, OpenWindow>): number {
  let ms = 0;
  for (const day of daysTouched(span.start, span.end)) {
    const w = windowsByDay.get(day);
    if (w) ms += overlapMs(span.start, span.end, w.open, w.close);
  }
  return ms / 60_000;
}

export const windowsByDay = (windows: OpenWindow[]) => new Map(windows.map((w) => [w.day, w]));

// ─── Rows ────────────────────────────────────────────────────────────────────

type Maybe<T> = T | T[] | null | undefined;
const one = <T,>(value: Maybe<T>): T | null => (Array.isArray(value) ? value[0] : value) ?? null;
const many = <T,>(value: Maybe<T>): T[] => (Array.isArray(value) ? value : value ? [value] : []);

export type RawInsightBooking = {
  id: string;
  workspace_id?: string | null;
  member_id?: string | null;
  start_date_time: string;
  end_date_time: string;
  booking_status?: string | null;
  /** Absent until add_booking_audit_columns.sql has run, and null on bookings made before it. */
  created_at?: string | null;
  cancelled_at?: string | null;
  members?: Maybe<{ full_name?: string | null; company_name?: string | null }>;
  payments?: Maybe<PaymentRow>;
};

export type InsightBooking = {
  id: string;
  roomId: string | null;
  memberId: string | null;
  member: string;
  company: string | null;
  start: number;
  end: number;
  status: string;
  createdAt: number | null;
  cancelledAt: number | null;
  /** A payment row exists, so this got through checkout, whatever happened after. */
  hasPayment: boolean;
  paid: number;
  refunded: number;
  net: number;
};

export type InsightRoom = {
  id: string;
  name: string;
  /** Active and bookable: it has time to sell. */
  sellable: boolean;
};

const instant = (iso: string | null | undefined) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

/** Null for a row whose times can't be read: it can't be placed on a day, so it can't be counted honestly. */
export function toInsightBooking(raw: RawInsightBooking): InsightBooking | null {
  const start = instant(raw.start_date_time);
  const end = instant(raw.end_date_time);
  if (start === null || end === null || end <= start) return null;
  const payments = many(raw.payments);
  const money = summarizePayments(payments);
  const person = one(raw.members);
  return {
    id: raw.id,
    roomId: raw.workspace_id ?? null,
    memberId: raw.member_id ?? null,
    member: person?.full_name?.trim() || "Member",
    company: person?.company_name?.trim() || null,
    start,
    end,
    status: (raw.booking_status ?? "").trim().toLowerCase(),
    createdAt: instant(raw.created_at),
    cancelledAt: instant(raw.cancelled_at),
    hasPayment: payments.length > 0,
    paid: money.totalPaid,
    refunded: money.totalRefunded,
    net: money.netSpend,
  };
}

export function toInsightBookings(rows: RawInsightBooking[]): InsightBooking[] {
  return rows.map(toInsightBooking).filter((b): b is InsightBooking => b !== null);
}

/**
 * Time actually sold: paid for and still going ahead. Pending rows are checkout
 * holds, not bookings. "completed" is declared in lib/constants but never
 * written; if it ever is, it means the same thing.
 */
export const isSold = (b: InsightBooking) => b.status === "confirmed" || b.status === "completed";

/** Bookings belong to the window their start falls in. */
export function inWindow(bookings: InsightBooking[], w: DayWindow): InsightBooking[] {
  const from = Date.parse(w.startUTC);
  const to = Date.parse(w.endUTC);
  return bookings.filter((b) => b.start >= from && b.start < to);
}

// ─── Headline numbers ────────────────────────────────────────────────────────

export type InsightSummary = {
  /** Paid minus refunded, on bookings that start in the window. */
  netRevenue: number;
  grossRevenue: number;
  refunded: number;
  bookings: number;
  bookedMinutes: number;
  capacityMinutes: number;
  /** Null when nothing was sellable (a closed-only window, or no rooms), never NaN or Infinity. */
  utilisation: number | null;
  averageMinutes: number | null;
  members: number;
};

/**
 * Revenue is counted on the day the booking happens, not payments.payment_date.
 * That column is a bare UTC date, so a 9am Melbourne payment is stamped the day
 * before; the booking's own start is exact, and it lines revenue up with the
 * utilisation it paid for.
 */
export function summarise(all: InsightBooking[], window: DayWindow, sellableRooms: number): InsightSummary {
  const bookings = inWindow(all, window);
  const windows = openWindows(window.startKey, window.endKey);
  const lookup = windowsByDay(windows);
  const sold = bookings.filter(isSold);
  const paid = bookings.filter((b) => b.hasPayment);

  const bookedMinutes = sold.reduce((sum, b) => sum + openMinutes(b, lookup), 0);
  const capacityMinutes = sellableMinutes(windows) * Math.max(0, sellableRooms);
  const totalMinutes = sold.reduce((sum, b) => sum + (b.end - b.start) / 60_000, 0);

  return {
    netRevenue: round2(paid.reduce((sum, b) => sum + b.net, 0)),
    grossRevenue: round2(paid.reduce((sum, b) => sum + b.paid, 0)),
    refunded: round2(paid.reduce((sum, b) => sum + b.refunded, 0)),
    bookings: sold.length,
    bookedMinutes,
    capacityMinutes,
    utilisation: capacityMinutes > 0 ? Math.min(1, bookedMinutes / capacityMinutes) : null,
    averageMinutes: sold.length ? totalMinutes / sold.length : null,
    members: new Set(sold.map((b) => b.memberId).filter(Boolean)).size,
  };
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export type RoomStat = {
  id: string;
  name: string;
  sellable: boolean;
  bookings: number;
  bookedMinutes: number;
  utilisation: number | null;
  revenue: number;
  cancelled: number;
};

/** Every sellable room, plus any retired room that still took bookings in the window. Busiest first. */
export function roomStats(rooms: InsightRoom[], all: InsightBooking[], window: DayWindow): RoomStat[] {
  const bookings = inWindow(all, window);
  const windows = openWindows(window.startKey, window.endKey);
  const lookup = windowsByDay(windows);
  const perRoom = sellableMinutes(windows);

  return rooms
    .map((room) => {
      const mine = bookings.filter((b) => b.roomId === room.id);
      const sold = mine.filter(isSold);
      const bookedMinutes = sold.reduce((sum, b) => sum + openMinutes(b, lookup), 0);
      return {
        id: room.id,
        name: room.name,
        sellable: room.sellable,
        bookings: sold.length,
        bookedMinutes,
        utilisation: room.sellable && perRoom > 0 ? Math.min(1, bookedMinutes / perRoom) : null,
        revenue: round2(mine.filter((b) => b.hasPayment).reduce((sum, b) => sum + b.net, 0)),
        cancelled: mine.filter((b) => b.hasPayment && b.status === "cancelled").length,
      };
    })
    .filter((r) => r.sellable || r.bookings > 0 || r.revenue !== 0)
    .sort((a, b) => b.bookedMinutes - a.bookedMinutes || b.revenue - a.revenue || a.name.localeCompare(b.name));
}

// ─── People ──────────────────────────────────────────────────────────────────

export type Spender = { memberId: string; name: string; company: string | null; net: number; bookings: number };

export function topSpenders(all: InsightBooking[], window: DayWindow, limit = 5): Spender[] {
  const totals = new Map<string, Spender>();
  for (const b of inWindow(all, window)) {
    if (!b.hasPayment || !b.memberId) continue;
    const current = totals.get(b.memberId) ?? { memberId: b.memberId, name: b.member, company: b.company, net: 0, bookings: 0 };
    current.net += b.net;
    current.bookings += 1;
    totals.set(b.memberId, current);
  }
  return [...totals.values()]
    .map((s) => ({ ...s, net: round2(s.net) }))
    .filter((s) => s.net > 0)
    .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ─── Revenue over time ───────────────────────────────────────────────────────

export type SeriesPoint = { key: string; label: string; value: number };

/** Daily points up to a month; weekly beyond that, so 90 days still reads as a trend rather than noise. */
export function revenueSeries(all: InsightBooking[], window: DayWindow): { points: SeriesPoint[]; bucketDays: number } {
  const span = daysBetweenKeys(window.startKey, window.endKey) + 1;
  const bucketDays = span <= 31 ? 1 : 7;
  const points: SeriesPoint[] = Array.from({ length: Math.ceil(span / bucketDays) }, (_, i) => {
    const key = addDaysToKey(window.startKey, i * bucketDays);
    return { key, label: shortDay(key), value: 0 };
  });
  for (const b of inWindow(all, window)) {
    if (!b.hasPayment) continue;
    const index = Math.floor(daysBetweenKeys(window.startKey, wallClockAt(b.start, HUB_TIMEZONE).date) / bucketDays);
    if (points[index]) points[index].value += b.net;
  }
  return { points: points.map((p) => ({ ...p, value: round2(p.value) })), bucketDays };
}

// ─── When the space is busy ──────────────────────────────────────────────────

export type HeatCell =
  | { state: "closed" }
  /** Open at this hour, but the window has no day of this weekday in it. */
  | { state: "none" }
  | { state: "open"; occupancy: number; minutes: number };

export type HeatRow = { weekday: number; label: string; cells: HeatCell[] };
export type HeatGrid = { hours: number[]; rows: HeatRow[] };

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday first, the way a working week reads. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const HEAT_HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i);

const openAt = (weekday: number, hour: number) => {
  const { open, close } = OPENING[weekday];
  return open !== null && close !== null && hour * 60 >= open && hour * 60 + 60 <= close;
};

/**
 * How full each hour of the week runs: booked room-minutes over the room-minutes
 * that hour could have sold. Closed hours are marked closed, not zero, because
 * "shut" and "open but empty" are different answers to "when are we quiet".
 */
export function hourHeat(all: InsightBooking[], window: DayWindow, sellableRooms: number): HeatGrid {
  const sold = inWindow(all, window).filter(isSold);
  const touching = new Map<string, InsightBooking[]>();
  for (const b of sold) {
    for (const day of daysTouched(b.start, b.end)) {
      const list = touching.get(day);
      if (list) list.push(b);
      else touching.set(day, [b]);
    }
  }

  const minutes = new Map<string, number>();
  const occurrences = new Map<number, number>();
  for (const w of openWindows(window.startKey, window.endKey)) {
    occurrences.set(w.weekday, (occurrences.get(w.weekday) ?? 0) + 1);
    const onDay = touching.get(w.day) ?? [];
    for (const hour of HEAT_HOURS) {
      if (!openAt(w.weekday, hour)) continue;
      const from = wallClockToUtc(w.day, hour * 60, HUB_TIMEZONE);
      const to = wallClockToUtc(w.day, hour * 60 + 60, HUB_TIMEZONE);
      const booked = onDay.reduce((sum, b) => sum + overlapMs(b.start, b.end, from, to), 0) / 60_000;
      const cell = `${w.weekday}:${hour}`;
      minutes.set(cell, (minutes.get(cell) ?? 0) + booked);
    }
  }

  const rooms = Math.max(0, sellableRooms);
  const rows = WEEK_ORDER.filter((weekday) => OPENING[weekday].open !== null).map((weekday) => ({
    weekday,
    label: WEEKDAY_NAMES[weekday],
    cells: HEAT_HOURS.map((hour): HeatCell => {
      if (!openAt(weekday, hour)) return { state: "closed" };
      const days = occurrences.get(weekday) ?? 0;
      if (days === 0) return { state: "none" };
      const booked = minutes.get(`${weekday}:${hour}`) ?? 0;
      const capacity = rooms * 60 * days;
      return { state: "open", minutes: booked, occupancy: capacity > 0 ? Math.min(1, booked / capacity) : 0 };
    }),
  }));
  return { hours: HEAT_HOURS, rows };
}

// ─── Booking behaviour ───────────────────────────────────────────────────────

export type Bucket = { key: string; label: string; count: number };

/**
 * How far ahead people book. Only bookings made after created_at started being
 * recorded can answer that, so the rest are counted as unknown rather than
 * guessed -- the page says how many of the bookings the chart covers.
 */
export function leadTimes(all: InsightBooking[], window: DayWindow): { buckets: Bucket[]; known: number; unknown: number } {
  const booked = inWindow(all, window).filter((b) => b.hasPayment || isSold(b));
  const buckets: Bucket[] = [
    { key: "same-day", label: "Same day", count: 0 },
    { key: "1-3", label: "1–3 days", count: 0 },
    { key: "4-7", label: "4–7 days", count: 0 },
    { key: "8+", label: "8+ days", count: 0 },
  ];
  let unknown = 0;
  for (const b of booked) {
    if (b.createdAt === null) {
      unknown += 1;
      continue;
    }
    const ahead = Math.max(0, daysBetweenKeys(wallClockAt(b.createdAt, HUB_TIMEZONE).date, wallClockAt(b.start, HUB_TIMEZONE).date));
    buckets[ahead === 0 ? 0 : ahead <= 3 ? 1 : ahead <= 7 ? 2 : 3].count += 1;
  }
  return { buckets, known: booked.length - unknown, unknown };
}

export type CancelStats = {
  /** Bookings that got through checkout. */
  paid: number;
  /** Of those, how many were later cancelled. */
  cancelled: number;
  rate: number | null;
  /** Checkouts started and never paid for. Not cancellations: nothing was bought. */
  abandoned: number;
  abandonRate: number | null;
  /** How much notice cancellations gave, in the refund policy's own bands. */
  notice: Bucket[];
  noticeUnknown: number;
};

/**
 * A booking only counts as cancelled if it was paid for first. Every checkout
 * inserts a booking row before Stripe, so an abandoned checkout also ends up
 * "cancelled" -- counting those would make the cancellation rate mostly a
 * measure of people closing a payment page.
 */
export function cancellations(all: InsightBooking[], window: DayWindow): CancelStats {
  const bookings = inWindow(all, window);
  const paid = bookings.filter((b) => b.hasPayment);
  const cancelled = paid.filter((b) => b.status === "cancelled");
  const abandoned = bookings.filter((b) => !b.hasPayment && b.status === "cancelled").length;

  const notice: Bucket[] = [
    { key: "full", label: `${FULL_REFUND_HOURS} h or more ahead`, count: 0 },
    { key: "half", label: `${HALF_REFUND_HOURS}–${FULL_REFUND_HOURS} h ahead`, count: 0 },
    { key: "none", label: `Under ${HALF_REFUND_HOURS} h`, count: 0 },
  ];
  let noticeUnknown = 0;
  for (const b of cancelled) {
    if (b.cancelledAt === null) {
      noticeUnknown += 1;
      continue;
    }
    const hours = (b.start - b.cancelledAt) / 3_600_000;
    notice[hours >= FULL_REFUND_HOURS ? 0 : hours >= HALF_REFUND_HOURS ? 1 : 2].count += 1;
  }

  return {
    paid: paid.length,
    cancelled: cancelled.length,
    rate: paid.length ? cancelled.length / paid.length : null,
    abandoned,
    abandonRate: abandoned + paid.length ? abandoned / (abandoned + paid.length) : null,
    notice,
    noticeUnknown,
  };
}

// ─── Chart geometry ──────────────────────────────────────────────────────────

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** A bar's length as a percentage of the longest. Zero, not NaN, when there's nothing to compare. */
export function barPercent(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return round2(Math.min(100, (value / max) * 100));
}

/**
 * SVG paths for a line in a width x height box, with the baseline at zero.
 * Pass `top` (the highest axis tick) so the line is drawn against the same scale
 * the axis labels describe, not stretched to touch the top of the box.
 */
export function sparkPaths(values: number[], width: number, height: number, top = 0): { line: string; area: string; points: { x: number; y: number }[] } {
  if (values.length === 0) return { line: "", area: "", points: [] };
  const max = Math.max(0, top, ...values);
  const min = Math.min(0, ...values);
  const spread = max - min || 1;
  const points = values.map((v, i) => ({
    x: round2(values.length === 1 ? width / 2 : (i * width) / (values.length - 1)),
    y: round2(height - ((v - min) / spread) * height),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const baseline = round2(height - ((0 - min) / spread) * height);
  const area = `${line} L${points[points.length - 1].x} ${baseline} L${points[0].x} ${baseline} Z`;
  return { line, area, points };
}

/**
 * Round axis ticks: 0, 500, 1,000 rather than 0, 437, 874. The top tick is the
 * first round number at or above the peak, so the line never pokes out of the
 * axis. A series of all zeros still gets a usable scale.
 */
export function niceTicks(peak: number, count = 3): { top: number; ticks: number[] } {
  if (!(peak > 0)) return { top: 1, ticks: [0] };
  const rough = peak / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const steps = Math.ceil(peak / step - 1e-9);
  return { top: round2(step * steps), ticks: Array.from({ length: steps + 1 }, (_, i) => round2(step * i)) };
}

/** The busiest open hour, and how many open hours sold nothing -- the two sentences under the heatmap. */
export function heatExtremes(grid: HeatGrid): { busiest: { label: string; hour: number; occupancy: number } | null; idleHours: number; openHours: number } {
  let busiest: { label: string; hour: number; occupancy: number } | null = null;
  let idleHours = 0;
  let openHours = 0;
  for (const row of grid.rows) {
    row.cells.forEach((cell, i) => {
      if (cell.state !== "open") return;
      openHours += 1;
      if (cell.occupancy === 0) idleHours += 1;
      else if (!busiest || cell.occupancy > busiest.occupancy) busiest = { label: row.label, hour: grid.hours[i], occupancy: cell.occupancy };
    });
  }
  return { busiest, idleHours, openHours };
}

/** Five steps of shading, so the heatmap reads at a glance and each step can carry a legend label. */
export function heatLevel(occupancy: number): 0 | 1 | 2 | 3 | 4 {
  if (!(occupancy > 0)) return 0;
  if (occupancy <= 0.15) return 1;
  if (occupancy <= 0.35) return 2;
  if (occupancy <= 0.6) return 3;
  return 4;
}

// ─── Formatting ──────────────────────────────────────────────────────────────
// Hand-rolled rather than Intl: these render on the server and the same strings
// must come out on every runtime (Node and browsers have disagreed before --
// see dateTile in lib/admin-dashboard.ts).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "18 Sep" */
export function shortDay(key: string): string {
  const [, m, d] = parseDateKey(key);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "18 Aug – 16 Sep" */
export function windowLabel(w: Pick<DayWindow, "startKey" | "endKey">): string {
  return w.startKey === w.endKey ? shortDay(w.startKey) : `${shortDay(w.startKey)} – ${shortDay(w.endKey)}`;
}

const group = (whole: number) => String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** "$1,234" -- whole dollars for headline figures. */
export function formatDollars(amount: number): string {
  const rounded = Math.round(amount);
  return `${rounded < 0 ? "-" : ""}$${group(Math.abs(rounded))}`;
}

/** "$1,234.50" -- to the cent, for tables. */
export function formatCents(amount: number): string {
  const [whole, cents] = Math.abs(amount).toFixed(2).split(".");
  return `${amount < 0 ? "-" : ""}$${group(Number(whole))}.${cents}`;
}

/** "12.5 h" */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours === 0) return "0 h";
  return `${hours >= 100 ? group(Math.round(hours)) : String(Number(hours.toFixed(1)))} h`;
}

/** "42%", or "<1%" rather than a misleading "0%" for a small but real share. */
export function formatPercent(fraction: number | null): string {
  if (fraction === null || !Number.isFinite(fraction)) return "—";
  const percent = fraction * 100;
  if (percent > 0 && percent < 1) return "<1%";
  return `${Math.round(percent)}%`;
}

export type Change = { direction: "up" | "down" | "flat"; label: string } | null;

/** Relative change between periods. Null when there's nothing to compare against. */
export function percentChange(current: number, previous: number): Change {
  if (!(previous > 0)) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return { direction: "flat", label: "No change" };
  return { direction: change > 0 ? "up" : "down", label: `${change > 0 ? "+" : ""}${change}%` };
}

/**
 * Change in a rate, in percentage points. A utilisation going from 10% to 15%
 * is "+5 pts", not "+50%": the relative figure would oversell a small move.
 */
export function pointsChange(current: number | null, previous: number | null): Change {
  if (current === null || previous === null) return null;
  const points = Math.round((current - previous) * 100);
  if (points === 0) return { direction: "flat", label: "No change" };
  return { direction: points > 0 ? "up" : "down", label: `${points > 0 ? "+" : ""}${points} pts` };
}

// ─── Where members came from ─────────────────────────────────────────────────

/**
 * What members who came in as leads spent in the window: the number that says
 * whether chasing enquiries is worth it. `memberIds` is every member a won lead
 * was linked to, whenever they converted; the spending is only this window's.
 */
export function spendByConverted(all: InsightBooking[], window: DayWindow, memberIds: ReadonlySet<string>): { net: number; members: number } {
  const spenders = new Set<string>();
  let net = 0;
  for (const b of inWindow(all, window)) {
    if (!b.hasPayment || !b.memberId || !memberIds.has(b.memberId)) continue;
    net += b.net;
    if (b.net > 0) spenders.add(b.memberId);
  }
  return { net: round2(net), members: spenders.size };
}

// ─── CSV export ──────────────────────────────────────────────────────────────

/** Plain words for the export, so a spreadsheet reader never has to decode "pending". */
export function bookingStatusLabel(b: InsightBooking): string {
  if (isSold(b)) return "Confirmed";
  if (b.status === "cancelled") return b.hasPayment ? "Cancelled" : "Checkout abandoned";
  if (b.status === "pending") return "Awaiting payment";
  return b.status ? `${b.status[0].toUpperCase()}${b.status.slice(1)}` : "Unknown";
}

/**
 * One CSV cell, RFC 4180 quoted. Member names and company names are typed by
 * members, and a spreadsheet runs any cell starting with = + - or @ as a
 * formula, so text like that is prefixed with an apostrophe to keep it text.
 * Numbers are ours and pass through untouched.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

const clockOf = (ms: number) => {
  const { mins } = wallClockAt(ms, HUB_TIMEZONE);
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};
const stampOf = (ms: number | null) => (ms === null ? null : `${wallClockAt(ms, HUB_TIMEZONE).date} ${clockOf(ms)}`);

export const CSV_HEADERS = ["Date", "Start", "End", "Hours", "Space", "Member", "Company", "Status", "Paid", "Refunded", "Net", "Booked on", "Cancelled on"];

/**
 * Every booking that starts in the window, in Melbourne time. Includes
 * abandoned checkouts and holds, labelled as such: an export that silently
 * dropped rows would never reconcile against Stripe.
 */
export function bookingsCsv(all: InsightBooking[], window: DayWindow, rooms: InsightRoom[]): string {
  const names = new Map(rooms.map((r) => [r.id, r.name]));
  const rows = [...inWindow(all, window)]
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
    .map((b) => [
      wallClockAt(b.start, HUB_TIMEZONE).date,
      clockOf(b.start),
      clockOf(b.end),
      round2((b.end - b.start) / 3_600_000),
      (b.roomId && names.get(b.roomId)) || "Unknown space",
      b.member,
      b.company,
      bookingStatusLabel(b),
      round2(b.paid),
      round2(b.refunded),
      round2(b.net),
      stampOf(b.createdAt),
      stampOf(b.cancelledAt),
    ]);
  // The byte-order mark makes Excel read the file as UTF-8, so accented names survive.
  return `\uFEFF${[CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** "inspire9-bookings-2026-08-20-to-2026-09-18.csv" */
export function csvFilename(window: Pick<DayWindow, "startKey" | "endKey">, roomName?: string | null): string {
  const slug = roomName ? `-${roomName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "";
  return `inspire9-bookings${slug}-${window.startKey}-to-${window.endKey}.csv`;
}

/** Links within the report keep the other filter: changing the range keeps the room, and the reverse. */
export function insightsHref(path: string, params: { range?: RangeKey; room?: string | null }): string {
  const query = new URLSearchParams();
  if (params.range && params.range !== DEFAULT_RANGE) query.set("range", params.range);
  if (params.room) query.set("room", params.room);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
