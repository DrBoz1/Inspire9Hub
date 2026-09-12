import { HUB_TIMEZONE } from "@/lib/datetime";
import { wallClockToUtc } from "@/features/booking-map/zoned-time";

export type BookedSlot = { start_date_time: string; end_date_time: string };

export function bookingInstant(date: string, hour: number) {
  return new Date(wallClockToUtc(date, Math.round(hour * 60), HUB_TIMEZONE)).toISOString();
}

export function rangeUnavailable(date: string, start: number, end: number, slots: BookedSlot[], now: number) {
  const from = Date.parse(bookingInstant(date, start));
  const to = Date.parse(bookingInstant(date, end));
  return from <= now || to <= from || slots.some(slot => Date.parse(slot.start_date_time) < to && Date.parse(slot.end_date_time) > from);
}
