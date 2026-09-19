import { describe, expect, it } from "vitest";
import { bookingInstant, firstBookableDay, rangeUnavailable } from "./booking-time";

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

describe("the day the booking form opens on", () => {
  // Melbourne is AEST (UTC+10) in September.
  const at = (iso: string) => Date.parse(iso);

  it("is today while an hour can still be booked", () => {
    expect(firstBookableDay(at("2026-09-24T23:00:00Z"))).toBe("2026-09-25"); // Fri 9am
  });

  it("moves on once today's last start has gone", () => {
    expect(firstBookableDay(at("2026-09-25T10:30:00Z"))).toBe("2026-09-26"); // Fri 8:30pm, last start 8pm
  });

  it("skips the Sunday the hub is closed", () => {
    expect(firstBookableDay(at("2026-09-19T23:00:00Z"))).toBe("2026-09-21"); // Sun 9am -> Mon
    expect(firstBookableDay(at("2026-09-26T08:00:00Z"))).toBe("2026-09-28"); // Sat 6pm, after closing -> Mon
  });
});
