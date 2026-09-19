import { describe, expect, it } from "vitest";
import { webhookRoute } from "./events";

describe("routing Stripe events", () => {
  it("keeps paying for a booking exactly where it was", () => {
    expect(webhookRoute("checkout.session.completed", "payment")).toBe("booking-paid");
    expect(webhookRoute("checkout.session.expired", "payment")).toBe("booking-expired");
  });

  it("never sends a membership checkout to the booking code", () => {
    // Before this, it would have: no booking metadata, a 400, three days of retries.
    expect(webhookRoute("checkout.session.completed", "subscription")).toBe("subscription-checkout");
    expect(webhookRoute("checkout.session.expired", "subscription")).toBe("ignore");
  });

  it("ignores other kinds of checkout rather than guessing", () => {
    expect(webhookRoute("checkout.session.completed", "setup")).toBe("ignore");
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
