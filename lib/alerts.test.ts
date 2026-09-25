import { describe, expect, it } from "vitest";
import { alertFacts, alertKey, alertSubject, type StaffAlert } from "./alerts";

const alert = (o: Partial<StaffAlert> = {}): StaffAlert => ({
  kind: "billing-unmatched",
  headline: "A payment couldn’t be matched to a member",
  ...o,
});

describe("alert keys", () => {
  const morning = new Date("2026-09-21T00:30:00.000Z"); // 10:30am Melbourne
  const evening = new Date("2026-09-21T09:00:00.000Z"); // 7pm the same Melbourne day

  it("is the same key all through one Melbourne day, so a retried event is one email", () => {
    expect(alertKey(alert({ ref: "cs_123" }), morning)).toBe(alertKey(alert({ ref: "cs_123" }), evening));
  });

  it("rolls over to a new key the next day, so an unfixed problem asks again", () => {
    const tomorrow = new Date("2026-09-22T00:30:00.000Z");
    expect(alertKey(alert({ ref: "cs_123" }), tomorrow)).not.toBe(alertKey(alert({ ref: "cs_123" }), morning));
  });

  it("uses the hub's day, not UTC's: late evening in Melbourne is still today", () => {
    // 9:30am UTC on the 21st is 7:30pm Melbourne on the 21st.
    expect(alertKey(alert({ ref: "cs_123" }), new Date("2026-09-21T09:30:00.000Z"))).toContain("2026-09-21");
  });

  it("keeps two different problems apart", () => {
    expect(alertKey(alert({ ref: "cs_1" }), morning)).not.toBe(alertKey(alert({ ref: "cs_2" }), morning));
  });

  it("keeps two kinds apart even with the same reference", () => {
    const a = alertKey(alert({ kind: "refund-failed", ref: "cs_1" }), morning);
    const b = alertKey(alert({ kind: "billing-unmatched", ref: "cs_1" }), morning);
    expect(a).not.toBe(b);
  });

  it("falls back to the headline when there's nothing to reference", () => {
    expect(alertKey(alert(), morning)).toContain("A payment couldn’t be matched to a member");
  });
});

describe("alert subjects", () => {
  it("says the kind and then what happened", () => {
    expect(alertSubject(alert())).toBe("Billing needs a person: A payment couldn’t be matched to a member");
  });

  it("names the other kinds too", () => {
    expect(alertSubject(alert({ kind: "refund-failed", headline: "x" }))).toMatch(/^A refund didn’t go through: /);
    expect(alertSubject(alert({ kind: "booking-unconfirmed", headline: "x" }))).toMatch(/^A paid booking isn’t confirmed: /);
    expect(alertSubject(alert({ kind: "janitor", headline: "x" }))).toMatch(/^The nightly check found something: /);
  });
});

describe("alert facts", () => {
  it("drops what isn't worth printing and turns the rest into text", () => {
    expect(alertFacts({ Session: "cs_123", Amount: 45, Member: null, Note: undefined, Blank: "  " })).toEqual([
      ["Session", "cs_123"],
      ["Amount", "45"],
    ]);
  });

  it("copes with no facts at all", () => {
    expect(alertFacts(undefined)).toEqual([]);
  });
});
