import { describe, expect, it } from "vitest";
import { bookingInstant, rangeUnavailable } from "./booking-time";

describe("booking selection time", () => {
  it("uses Melbourne time on both sides of daylight saving", () => {
    expect(bookingInstant("2026-09-20", 10)).toBe("2026-09-20T00:00:00.000Z");
    expect(bookingInstant("2026-10-20", 10)).toBe("2026-10-19T23:00:00.000Z");
  });
  it("preserves partial-hour bookings in availability", () => {
    const slots = [{ start_date_time: bookingInstant("2026-09-20", 10.5), end_date_time: bookingInstant("2026-09-20", 11.5) }];
    expect(rangeUnavailable("2026-09-20", 10, 11, slots, 0)).toBe(true);
    expect(rangeUnavailable("2026-09-20", 11, 12, slots, 0)).toBe(true);
    expect(rangeUnavailable("2026-09-20", 9, 10.5, slots, 0)).toBe(false);
    expect(rangeUnavailable("2026-09-20", 11.5, 12.5, slots, 0)).toBe(false);
  });
  it("allows a reservation to end exactly when the next one begins", () => {
    const slots = [{ start_date_time: bookingInstant("2026-09-20", 11), end_date_time: bookingInstant("2026-09-20", 12) }];
    expect(rangeUnavailable("2026-09-20", 10, 11, slots, 0)).toBe(false);
  });
  it("rejects a passed start and reversed ranges", () => {
    expect(rangeUnavailable("2026-09-20", 10, 11, [], Date.parse(bookingInstant("2026-09-20", 10)))).toBe(true);
    expect(rangeUnavailable("2026-09-20", 11, 10, [], 0)).toBe(true);
  });
});
