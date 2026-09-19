import { HUB_TIMEZONE } from "@/lib/datetime";
import { OPENING, SLOT } from "@/features/booking-map/booking/time";
import { addDaysToKey, todayIn, wallClockAt, weekdayOfKey } from "@/features/booking-map/zoned-time";

/**
 * The rules every booking must meet, checked on the server. The booking screens
 * already keep to them, but a server action is a public endpoint: anyone signed
 * in can call it with any times. Without these, one member could hold every room
 * around the clock for months, since each pending hold blocks everyone else.
 */

/** The same limit the booking form's date picker uses. */
export const HORIZON_DAYS = 180;
export const MIN_MINUTES = 60;
/** Checkouts one member can have open at once. A person pays for one at a time. */
export const MAX_ACTIVE_HOLDS = 3;
/**
 * A hold older than this is left over from a checkout that ended without Stripe
 * telling us (its session lasts 30 minutes). It's released rather than blocking
 * the room for good.
 */
export const STALE_HOLD_MINUTES = 120;

export type BookingWindow = { startISO: string; endISO: string; date: string; from: number; to: number; hours: number };
export type WindowCheck = { ok: true; value: BookingWindow } | { ok: false; error: string };

const fail = (error: string): WindowCheck => ({ ok: false, error });
const clock = (mins: number) => {
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12}${mins % 60 ? `:${String(mins % 60).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
};

export function checkBookingWindow(start: unknown, end: unknown, now: Date, tz = HUB_TIMEZONE): WindowCheck {
  if (typeof start !== "string" || typeof end !== "string") return fail("Pick a start and end time.");
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return fail("Those times don’t look right. Pick them again.");
  if (e <= s) return fail("Start time must be before end time.");
  if (e - s < MIN_MINUTES * 60_000) return fail("Minimum booking is 1 hour.");
  if (s < now.getTime()) return fail("Cannot book a time that has already passed.");

  const from = wallClockAt(s, tz);
  const to = wallClockAt(e, tz);
  if (from.date !== to.date) return fail("A booking has to start and end on the same day.");
  if (from.date > addDaysToKey(todayIn(tz, now.getTime()), HORIZON_DAYS)) return fail(`You can book up to ${HORIZON_DAYS} days ahead.`);
  if (s % 60_000 || e % 60_000 || from.mins % SLOT || to.mins % SLOT) return fail(`Times must be on a ${SLOT}-minute slot.`);

  const hours = OPENING[weekdayOfKey(from.date)];
  if (hours.open === null || hours.close === null) return fail("The hub is closed that day.");
  if (from.mins < hours.open || to.mins > hours.close) return fail(`That’s outside opening hours (${clock(hours.open)} to ${clock(hours.close)}).`);

  return { ok: true, value: { startISO: new Date(s).toISOString(), endISO: new Date(e).toISOString(), date: from.date, from: from.mins, to: to.mins, hours: (e - s) / 3_600_000 } };
}

/** When a pending hold stops counting as a checkout in progress. */
export function staleHoldCutoff(now: Date): string {
  return new Date(now.getTime() - STALE_HOLD_MINUTES * 60_000).toISOString();
}

/**
 * A read-only look at when rooms are busy. Signed-in members only, and never
 * wider than a day and a bit (a daylight-saving day is 25 hours), so nobody can
 * ask for a year of bookings in one call.
 */
export function checkLookupWindow(start: unknown, end: unknown): { ok: true; startISO: string; endISO: string } | { ok: false } {
  if (typeof start !== "string" || typeof end !== "string") return { ok: false };
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || e - s > 26 * 3_600_000) return { ok: false };
  return { ok: true, startISO: new Date(s).toISOString(), endISO: new Date(e).toISOString() };
}

export const isUuidLike = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
