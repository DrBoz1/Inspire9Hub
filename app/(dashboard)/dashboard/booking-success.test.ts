import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterCheck, describeBooking, MAX_CHECKS, successBookingId, type SuccessBooking } from "./booking-success";

const ID = "8f3c2a91-4b7e-4d2a-9c1e-2b5f7a3d9e10";
const booking = (o: Partial<SuccessBooking> = {}): SuccessBooking => ({
  id: ID,
  booking_status: "confirmed",
  // Friday 18 September, 9–11am in Melbourne (still Thursday in UTC).
  start_date_time: "2026-09-17T23:00:00.000Z",
  end_date_time: "2026-09-18T01:00:00.000Z",
  workspaces: { name: "Dream Room" },
  amount: 24,
  ...o,
});

describe("reading Stripe's return", () => {
  it("finds the booking id after a successful payment", () => {
    expect(successBookingId(`?status=success&bookingId=${ID}`)).toBe(ID);
  });

  it("ignores anything else", () => {
    expect(successBookingId(`?status=cancelled&bookingId=${ID}`)).toBeNull();
    expect(successBookingId("?status=success")).toBeNull();
    expect(successBookingId("?status=success&bookingId=not-a-booking")).toBeNull();
    expect(successBookingId("")).toBeNull();
  });
});

describe("what each lookup means", () => {
  it("shows the booking once it's confirmed", () => {
    const r = afterCheck(booking(), 0);
    expect(r.retry).toBe(false);
    expect(r.state.phase).toBe("confirmed");
  });

  it("keeps confirming while the booking is still pending", () => {
    expect(afterCheck(booking({ booking_status: "pending" }), 0)).toEqual({ state: { phase: "confirming" }, retry: true });
  });

  it("stops waiting on the last check and says it's still processing", () => {
    expect(afterCheck(booking({ booking_status: "pending" }), MAX_CHECKS - 1)).toEqual({ state: { phase: "processing" }, retry: false });
  });

  it("retries a failed lookup, then gives the same honest answer", () => {
    expect(afterCheck("error", 0)).toEqual({ state: { phase: "confirming" }, retry: true });
    expect(afterCheck("error", MAX_CHECKS - 1)).toEqual({ state: { phase: "processing" }, retry: false });
  });

  it("flags a booking that was cancelled", () => {
    expect(afterCheck(booking({ booking_status: "cancelled" }), 0)).toEqual({ state: { phase: "attention" }, retry: false });
  });

  it("shows nothing for a booking that isn't this member's", () => {
    expect(afterCheck(null, 0)).toEqual({ state: { phase: "closed" }, retry: false });
  });
});

describe("the details shown", () => {
  it("uses Melbourne time, not the browser's", () => {
    const d = describeBooking(booking());
    expect(d.weekday).toBe("Friday");
    expect(d.day).toBe("18");
    expect(d.monthLong).toBe("September");
    expect(d.timeRange).toBe("9:00 am – 11:00 am");
    expect(d.duration).toBe("2 hours");
  });

  it("follows daylight saving", () => {
    const d = describeBooking(booking({ start_date_time: "2026-12-01T23:00:00.000Z", end_date_time: "2026-12-02T00:30:00.000Z" }));
    expect([d.weekday, d.day, d.timeRange, d.duration]).toEqual(["Wednesday", "2", "10:00 am – 11:30 am", "1 hr 30 min"]);
  });

  it("formats the amount, whatever type it arrives as", () => {
    expect(describeBooking(booking({ amount: "24.5" })).amount).toBe("$24.50");
    expect(describeBooking(booking({ amount: null })).amount).toBeNull();
  });

  it("reads the room from either shape Supabase returns", () => {
    expect(describeBooking(booking({ workspaces: [{ name: "Pool Room" }] })).room).toBe("Pool Room");
    expect(describeBooking(booking({ workspaces: null })).room).toBe("Your space");
  });

  it("gives a short reference members can quote", () => {
    expect(describeBooking(booking()).reference).toBe("8F3C2A91");
  });

  it("never formats times with the browser's timezone", () => {
    const modal = readFileSync(join(import.meta.dirname, "BookingSuccessModal.tsx"), "utf8");
    expect(modal).not.toMatch(/date-fns|parseISO|toLocale(Date|Time)?String\(/);
  });
});
