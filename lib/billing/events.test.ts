import { describe, expect, it } from "vitest";
import { isBookingCheckout, webhookRoute } from "./events";

const BOOKING = { userId: "u1", workspaceId: "w1", bookingId: "b1", startTime: "2026-09-20T01:00:00Z", endTime: "2026-09-20T02:00:00Z" };

describe("routing Stripe events", () => {
  it("keeps paying for a booking exactly where it was", () => {
    expect(webhookRoute("checkout.session.completed", { mode: "payment", metadata: BOOKING })).toBe("booking-paid");
    expect(webhookRoute("checkout.session.expired", { mode: "payment", metadata: BOOKING })).toBe("booking-expired");
  });

  it("never sends a membership checkout to the booking code", () => {
    // Before this, it would have: no booking metadata, a 400, three days of retries.
    expect(webhookRoute("checkout.session.completed", { mode: "subscription", metadata: { member_id: "m1" } })).toBe("subscription-checkout");
    expect(webhookRoute("checkout.session.expired", { mode: "subscription" })).toBe("ignore");
  });

  it("acknowledges a payment that isn't a booking instead of rejecting it for days", () => {
    // Stripe's example product was paid on 19 Sep 2026 and retried against the site.
    expect(webhookRoute("checkout.session.completed", { mode: "payment", metadata: {} })).toBe("ignore");
    expect(webhookRoute("checkout.session.completed", { mode: "payment", metadata: null })).toBe("ignore");
    expect(webhookRoute("checkout.session.completed", { mode: "payment", metadata: { ...BOOKING, startTime: "" } })).toBe("ignore");
  });

  it("knows a booking checkout by the four details every booking sets", () => {
    expect(isBookingCheckout(BOOKING)).toBe(true);
    // Sessions from before the atomic flow have no bookingId, and are still bookings.
    expect(isBookingCheckout({ userId: "u1", workspaceId: "w1", startTime: BOOKING.startTime, endTime: BOOKING.endTime })).toBe(true);
    expect(isBookingCheckout({ ...BOOKING, userId: "" })).toBe(false);
  });

  it("ignores other kinds of checkout rather than guessing", () => {
    expect(webhookRoute("checkout.session.completed", { mode: "setup" })).toBe("ignore");
    expect(webhookRoute("checkout.session.completed", { mode: null })).toBe("ignore");
    expect(webhookRoute("checkout.session.completed", null)).toBe("ignore");
  });

  it("sends subscription and invoice changes to billing", () => {
    for (const type of ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]) {
      expect(webhookRoute(type)).toBe("subscription");
    }
    expect(webhookRoute("invoice.paid")).toBe("invoice");
    expect(webhookRoute("invoice.payment_failed")).toBe("invoice");
  });

  it("acknowledges anything else instead of failing", () => {
    expect(webhookRoute("charge.refunded")).toBe("ignore");
    expect(webhookRoute("invoice.finalized")).toBe("ignore");
  });
});
