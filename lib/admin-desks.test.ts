import { describe, expect, it } from "vitest";
import { DAY_PRICE_MAX, DAY_PRICE_MIN, deskPriceNote, parseDayPrice, summariseDesks, type RawDesk } from "./admin-desks";

const desk = (o: Partial<RawDesk> = {}): RawDesk => ({ id: "d1", name: "Desk A1", code: "A1", price_per_day: 35, ...o });

describe("summariseDesks", () => {
  it("counts desks, the ones on sale, and the price they share", () => {
    const s = summariseDesks([desk(), desk({ id: "d2" }), desk({ id: "d3", price_per_day: null })]);
    expect(s).toEqual({ total: 3, sellable: 3, onSale: 2, price: 35, mixed: false });
  });

  it("reads a price that arrives as a string", () => {
    expect(summariseDesks([desk({ price_per_day: "35.00" })]).price).toBe(35);
  });

  it("treats a desk with no price, or a nonsense one, as not on sale", () => {
    for (const p of [null, undefined, 0, -5, "free"]) {
      expect(summariseDesks([desk({ price_per_day: p as never })]).onSale, String(p)).toBe(0);
    }
  });

  it("says so when desks carry different prices, and shows the lowest", () => {
    const s = summariseDesks([desk({ price_per_day: 45 }), desk({ id: "d2", price_per_day: 35 })]);
    expect(s.mixed).toBe(true);
    expect(s.price).toBe(35);
  });

  it("counts a switched-off desk as one that exists but can't sell", () => {
    const s = summariseDesks([desk(), desk({ id: "d2", active: false }), desk({ id: "d3", bookable: false })]);
    expect(s.total).toBe(3);
    expect(s.sellable).toBe(1);
  });

  it("has nothing to say about no desks at all", () => {
    expect(summariseDesks([])).toEqual({ total: 0, sellable: 0, onSale: 0, price: null, mixed: false });
  });
});

describe("parseDayPrice", () => {
  it("accepts dollars and cents", () => {
    expect(parseDayPrice("35")).toEqual({ value: 35 });
    expect(parseDayPrice(" 35.50 ")).toEqual({ value: 35.5 });
  });

  it.each(["", "free", "35.555", "-35", "3 5", "$35"])("refuses %s", (raw) => {
    expect(parseDayPrice(raw)).toHaveProperty("error");
  });

  it("keeps the price inside sane bounds", () => {
    expect(parseDayPrice(String(DAY_PRICE_MIN - 1))).toHaveProperty("error");
    expect(parseDayPrice(String(DAY_PRICE_MAX + 1))).toHaveProperty("error");
    expect(parseDayPrice(String(DAY_PRICE_MAX))).toEqual({ value: DAY_PRICE_MAX });
  });
});

describe("deskPriceNote", () => {
  const note = (rows: RawDesk[]) => deskPriceNote(summariseDesks(rows));

  it("points at the migration when there are no desks", () => {
    expect(note([])).toMatch(/migration/);
  });

  it("says how to open them when none is on sale", () => {
    expect(note([desk({ price_per_day: null })])).toMatch(/none on sale/);
  });

  it("says the price when they all share one", () => {
    expect(note([desk(), desk({ id: "d2" })])).toBe("All 2 desks on sale at $35 a day.");
  });

  it("counts the ones on sale when only some are", () => {
    expect(note([desk(), desk({ id: "d2", price_per_day: null })])).toBe("1 of 2 desks on sale at $35 a day.");
  });

  it("warns that saving levels different prices", () => {
    expect(note([desk({ price_per_day: 45 }), desk({ id: "d2", price_per_day: 35 })])).toMatch(/from \$35 a day\. Saving a price/);
  });
});
