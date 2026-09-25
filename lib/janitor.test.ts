import { describe, expect, it } from "vitest";
import { HOLD_GRACE_MINUTES, holdCutoff, splitHolds, sweepIsUnusual, sweepSummary, type PendingHold } from "./janitor";

const hold = (o: Partial<PendingHold> = {}): PendingHold => ({
  id: "b1",
  memberId: "m1",
  startISO: "2026-09-22T01:00:00.000Z",
  createdISO: "2026-09-21T23:00:00.000Z",
  ...o,
});

describe("holdCutoff", () => {
  it("is the grace window back from now", () => {
    const now = new Date("2026-09-22T03:00:00.000Z");
    expect(holdCutoff(now)).toBe(new Date(now.getTime() - HOLD_GRACE_MINUTES * 60_000).toISOString());
  });

  it("is long enough to outlast a Stripe checkout, which expires in 30 minutes", () => {
    expect(HOLD_GRACE_MINUTES).toBeGreaterThanOrEqual(60);
  });
});

describe("splitHolds", () => {
  it("releases an abandoned hold", () => {
    const { release, stranded } = splitHolds([hold()], new Set());
    expect(release.map((h) => h.id)).toEqual(["b1"]);
    expect(stranded).toEqual([]);
  });

  it("never cancels a booking that was paid for", () => {
    const { release, stranded } = splitHolds([hold()], new Set(["b1"]));
    expect(release).toEqual([]);
    expect(stranded.map((h) => h.id)).toEqual(["b1"]);
  });

  it("sorts a mixed night into the two piles", () => {
    const holds = [hold({ id: "b1" }), hold({ id: "b2" }), hold({ id: "b3" })];
    const { release, stranded } = splitHolds(holds, new Set(["b2"]));
    expect(release.map((h) => h.id)).toEqual(["b1", "b3"]);
    expect(stranded.map((h) => h.id)).toEqual(["b2"]);
  });

  it("leaves a hold with no created_at alone: it can't be aged, so it isn't judged", () => {
    const { release, stranded } = splitHolds([hold({ createdISO: null })], new Set());
    expect(release).toEqual([]);
    expect(stranded).toEqual([]);
  });

  it("has nothing to do with an empty night", () => {
    expect(splitHolds([], new Set())).toEqual({ release: [], stranded: [] });
  });
});

describe("sweepIsUnusual", () => {
  it("shrugs at a normal night", () => {
    expect(sweepIsUnusual(0)).toBe(false);
    expect(sweepIsUnusual(3)).toBe(false);
  });

  it("speaks up when a pile of holds turns up at once", () => {
    expect(sweepIsUnusual(40)).toBe(true);
  });
});

describe("sweepSummary", () => {
  it("says when there was nothing to do", () => {
    expect(sweepSummary(0, 0)).toBe("Nothing to sweep.");
  });

  it("counts in ones and manys", () => {
    expect(sweepSummary(1, 0)).toBe("1 hold released.");
    expect(sweepSummary(4, 0)).toBe("4 holds released.");
  });

  it("names the paid ones it wouldn't touch", () => {
    expect(sweepSummary(2, 1)).toBe("2 holds released, 1 paid booking left for a person.");
    expect(sweepSummary(0, 2)).toBe("0 holds released, 2 paid bookings left for a person.");
  });
});
