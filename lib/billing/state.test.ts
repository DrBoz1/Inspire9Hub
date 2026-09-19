import { describe, expect, it } from "vitest";
import {
  GRACE_DAYS,
  billingDay,
  currentSubscription,
  hasHubAccess,
  isFresherEvent,
  membershipState,
  mrrCents,
  periodLabel,
  renewalNotice,
  shouldRetryUnresolved,
  type SubscriptionSnapshot,
} from "./state";

const NOW = new Date("2026-09-20T02:00:00Z");
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

const sub = (over: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: daysFromNow(14),
  endedAt: null,
  unitAmountCents: 45000,
  quantity: 1,
  currency: "aud",
  billingInterval: "month",
  intervalCount: 1,
  ...over,
});

describe("what a subscription means for a member", () => {
  it("has no membership without a subscription", () => {
    expect(membershipState(null, NOW)).toBe("none");
  });

  it("treats a trial as a member", () => {
    expect(membershipState(sub({ status: "trialing" }), NOW)).toBe("active");
    expect(hasHubAccess("active")).toBe(true);
  });

  it("keeps a member who cancelled until the end of what they paid for", () => {
    const cancelled = sub({ cancelAtPeriodEnd: true });
    expect(membershipState(cancelled, NOW)).toBe("active");
    expect(hasHubAccess(membershipState(cancelled, NOW))).toBe(true);
  });

  it("gives a failed payment a grace period, then lapses", () => {
    expect(membershipState(sub({ status: "past_due", currentPeriodEnd: daysFromNow(-2) }), NOW)).toBe("grace");
    expect(hasHubAccess("grace")).toBe(true);
    expect(membershipState(sub({ status: "past_due", currentPeriodEnd: daysFromNow(-(GRACE_DAYS + 3)) }), NOW)).toBe("lapsed");
    expect(hasHubAccess("lapsed")).toBe(false);
  });

  it("counts the last moment of the grace period as still in it", () => {
    const end = new Date(NOW.getTime() - GRACE_DAYS * 86_400_000).toISOString();
    expect(membershipState(sub({ status: "past_due", currentPeriodEnd: end }), NOW)).toBe("grace");
  });

  it("doesn't lock someone out when it can't tell when their period ended", () => {
    expect(membershipState(sub({ status: "past_due", currentPeriodEnd: null }), NOW)).toBe("grace");
  });

  it("maps every other Stripe status", () => {
    expect(membershipState(sub({ status: "incomplete" }), NOW)).toBe("pending");
    expect(membershipState(sub({ status: "unpaid" }), NOW)).toBe("lapsed");
    expect(membershipState(sub({ status: "paused" }), NOW)).toBe("lapsed");
    expect(membershipState(sub({ status: "incomplete_expired" }), NOW)).toBe("ended");
    // Only right because the billing portal cancels at the end of the period.
    expect(membershipState(sub({ status: "canceled", currentPeriodEnd: daysFromNow(10) }), NOW)).toBe("ended");
    expect(hasHubAccess("pending")).toBe(false);
    expect(hasHubAccess("ended")).toBe(false);
  });
});

describe("the line on a member's billing page", () => {
  it("says when it renews, or when it ends if they've cancelled", () => {
    expect(renewalNotice(sub(), NOW)).toMatchObject({ kind: "renews", label: "Renews 4 Oct", tone: "positive" });
    expect(renewalNotice(sub({ cancelAtPeriodEnd: true }), NOW)).toMatchObject({ kind: "ends", label: "Ends 4 Oct", tone: "warning" });
  });

  it("flags an overdue payment as urgent", () => {
    expect(renewalNotice(sub({ status: "past_due", currentPeriodEnd: daysFromNow(-1) }), NOW)).toMatchObject({ kind: "overdue", tone: "danger" });
  });

  it("covers trials, unfinished first payments, endings and nothing at all", () => {
    expect(renewalNotice(sub({ status: "trialing" }), NOW).kind).toBe("trial");
    expect(renewalNotice(sub({ status: "incomplete" }), NOW).kind).toBe("pending");
    expect(renewalNotice(sub({ status: "canceled", endedAt: "2026-09-01T02:00:00Z" }), NOW)).toMatchObject({ kind: "inactive", label: "Ended 1 Sep" });
    expect(renewalNotice(null, NOW)).toMatchObject({ kind: "inactive", label: "No membership" });
  });

  it("dates renewals on the Melbourne calendar, on both sides of daylight saving", () => {
    // 3 Oct 14:30 UTC is already 4 October in Melbourne (+10 until the 4th).
    expect(billingDay("2026-10-03T14:30:00Z")).toBe("4 Oct");
    // 13:30 UTC on 4 Oct is 12:30am on the 5th, now on +11.
    expect(billingDay("2026-10-04T13:30:00Z")).toBe("5 Oct");
  });
});

describe("monthly recurring revenue", () => {
  it("normalises every billing cycle to a month", () => {
    expect(mrrCents([sub()], "aud")).toBe(45000);
    expect(mrrCents([sub({ billingInterval: "year", unitAmountCents: 120000 })], "aud")).toBe(10000);
    expect(mrrCents([sub({ billingInterval: "month", intervalCount: 3, unitAmountCents: 30000 })], "aud")).toBe(10000);
    expect(mrrCents([sub({ quantity: 5, unitAmountCents: 15000 })], "aud")).toBe(75000);
  });

  it("rounds once, after adding up", () => {
    // Rounding each $1,000 annual plan first would give 8333 x 3 = 24999.
    const annual = sub({ billingInterval: "year", unitAmountCents: 100000 });
    expect(mrrCents([annual, annual, annual], "aud")).toBe(25000);
  });

  it("counts what's being collected, not trials or the finished", () => {
    expect(mrrCents([sub({ status: "trialing" }), sub({ status: "canceled" }), sub({ status: "incomplete" })], "aud")).toBe(0);
    expect(mrrCents([sub({ status: "past_due", currentPeriodEnd: daysFromNow(-1) })], "aud")).toBe(45000);
  });

  it("never adds two currencies together, whatever case they're written in", () => {
    expect(mrrCents([sub(), sub({ currency: "usd", unitAmountCents: 99999 })], "aud")).toBe(45000);
    expect(mrrCents([sub({ currency: "AUD" })], "aud")).toBe(45000);
    expect(mrrCents([], "aud")).toBe(0);
  });
});

describe("handling events out of order", () => {
  it("applies an event only if it's at least as new as what's stored", () => {
    expect(isFresherEvent(200, 100)).toBe(true);
    expect(isFresherEvent(100, 100)).toBe(true);
    expect(isFresherEvent(99, 100)).toBe(false);
  });

  it("lets Stripe retry an unmatched event for a while, then stops", () => {
    const created = NOW.getTime() / 1000;
    expect(shouldRetryUnresolved(created - 14 * 60, NOW)).toBe(true);
    expect(shouldRetryUnresolved(created - 16 * 60, NOW)).toBe(false);
  });
});

describe("which subscription a member's page shows", () => {
  const s = (status: string, createdAt: string) => ({ status, createdAt });
  it("shows the live one, even if an older finished one is newer in the list", () => {
    expect(currentSubscription([s("canceled", "2026-09-01"), s("active", "2025-01-01")])?.status).toBe("active");
    expect(currentSubscription([s("past_due", "2026-01-01"), s("incomplete_expired", "2026-09-01")])?.status).toBe("past_due");
  });
  it("otherwise shows the most recent, so a past member sees how it ended", () => {
    expect(currentSubscription([s("canceled", "2025-01-01"), s("canceled", "2026-03-01")])?.createdAt).toBe("2026-03-01");
    expect(currentSubscription([])).toBeNull();
  });
});

describe("billing periods", () => {
  it("ends on the last day paid for, not the first day of the next period", () => {
    // Midnight 1 Oct to midnight 1 Nov, Melbourne time.
    expect(periodLabel("2026-09-30T14:00:00Z", "2026-10-31T13:00:00Z")).toBe("1 Oct – 31 Oct");
  });
});
