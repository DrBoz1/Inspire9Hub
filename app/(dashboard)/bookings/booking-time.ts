import { HUB_TIMEZONE } from "@/lib/datetime";
import { addDaysToKey, todayIn, wallClockToUtc } from "@/features/booking-map/zoned-time";
import { wholeHourStarts } from "@/features/booking-map/booking/time";

export type BookedSlot = { start_date_time: string; end_date_time: string };

export function bookingInstant(date: string, hour: number) {
  return new Date(wallClockToUtc(date, Math.round(hour * 60), HUB_TIMEZONE)).toISOString();
}

export function rangeUnavailable(date: string, start: number, end: number, slots: BookedSlot[], now: number) {
  const from = Date.parse(bookingInstant(date, start));
  const to = Date.parse(bookingInstant(date, end));
  return from <= now || to <= from || slots.some(slot => Date.parse(slot.start_date_time) < to && Date.parse(slot.end_date_time) > from);
}

/**
 * The day the booking form opens on: today while an hour can still be booked,
 * otherwise the next day the hub is open. It used to open on today regardless, so
 * on a Sunday, or after the last start time, every member had to change the date
 * before they could do anything else.
 */
export function firstBookableDay(nowMs: number): string {
  const today = todayIn(HUB_TIMEZONE, nowMs);
  for (let i = 0; i < 8; i++) {
    const day = addDaysToKey(today, i);
    if (wholeHourStarts(day).some((hour) => Date.parse(bookingInstant(day, hour)) > nowMs)) return day;
  }
  return today;
}
