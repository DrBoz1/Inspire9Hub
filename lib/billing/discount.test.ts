import { describe, expect, it } from "vitest";
import { memberRate, memberTotal, parseDiscount, withMemberRates } from "./discount";

describe("member discounts", () => {
  it("reads a percentage from Stripe metadata, and ignores nonsense", () => {
    expect(parseDiscount("20")).toBe(20);
    expect(parseDiscount(" 15% ")).toBe(15);
    expect(parseDiscount(12.6)).toBe(13);
    expect(parseDiscount("150")).toBe(100);
    expect(parseDiscount("-5")).toBe(0);
    expect(parseDiscount("lots")).toBe(0);
    expect(parseDiscount(undefined)).toBe(0);
  });

  it("works out the member rate to the cent", () => {
    expect(memberRate(45, 20)).toBe(36);
    expect(memberRate(25, 15)).toBe(21.25);
    expect(memberRate(45, 0)).toBe(45);
    expect(memberRate(45, 100)).toBe(0);
  });

  it("rounds a booking once, from the full price", () => {
    // 1.5 h x $25 = $37.50, less 15% = $31.875, so $31.88. Rounding the rate first gives $31.87.
    expect(memberTotal(25, 1.5, 15)).toBe(31.88);
    expect(memberTotal(80, 2, 20)).toBe(128);
    expect(memberTotal(45, 1, 0)).toBe(45);
  });

  it("shows rooms at the member rate, keeping the full price to compare against", () => {
    const rooms = [{ id: "r1", price_per_hour: 45, regular_price_per_hour: 45 }, { id: "r2", price_per_hour: "80", regular_price_per_hour: null }];
    expect(withMemberRates(rooms, 20)).toEqual([
      { id: "r1", price_per_hour: 36, regular_price_per_hour: 45, member_discount_percent: 20 },
      { id: "r2", price_per_hour: 64, regular_price_per_hour: 80, member_discount_percent: 20 },
    ]);
  });

  it("leaves rooms untouched for someone without a member rate", () => {
    const rooms = [{ id: "r1", price_per_hour: 45, regular_price_per_hour: 50 }];
    expect(withMemberRates(rooms, 0)).toEqual([{ id: "r1", price_per_hour: 45, regular_price_per_hour: 50, member_discount_percent: 0 }]);
  });

  it("doesn't invent a price for a room that has none", () => {
    expect(withMemberRates([{ id: "r1", price_per_hour: null }], 20)[0]).toEqual({ id: "r1", price_per_hour: null, member_discount_percent: 0 });
  });
});
