import { afterEach, describe, expect, it, vi } from "vitest";
import { calcRefundCents, getRefundPolicy } from "./refund-policy";

describe("refund amount", () => {
  it("rounds to the cent, not the dollar", () => {
    // Rounding whole dollars first turned $12.50 into a $13 refund, more than was paid.
    expect(calcRefundCents(12.5, 100)).toBe(1250);
    expect(calcRefundCents(24.5, 50)).toBe(1225);
    expect(calcRefundCents(12, 50)).toBe(600);
    expect(calcRefundCents(19.99, 100)).toBe(1999);
    expect(calcRefundCents(24, 0)).toBe(0);
  });

  it("never refunds more than was paid", () => {
    for (const amount of [0.01, 6, 12.5, 19.99, 24.75, 99.95, 180]) {
      expect(calcRefundCents(amount, 100)).toBeLessThanOrEqual(Math.round(amount * 100));
      expect(calcRefundCents(amount, 50)).toBeLessThanOrEqual(Math.ceil(amount * 50));
    }
  });
});

describe("refund policy", () => {
  afterEach(() => vi.useRealTimers());
  const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

  it("follows the 48 hour and 4 hour tiers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T00:00:00Z"));
    expect(getRefundPolicy(hoursFromNow(72)).percent).toBe(100);
    expect(getRefundPolicy(hoursFromNow(48)).percent).toBe(100);
    expect(getRefundPolicy(hoursFromNow(10)).percent).toBe(50);
    expect(getRefundPolicy(hoursFromNow(4)).percent).toBe(50);
    expect(getRefundPolicy(hoursFromNow(2))).toMatchObject({ percent: 0, label: "No Refund" });
    expect(getRefundPolicy(hoursFromNow(-1)).description).toContain("already started");
  });
});
