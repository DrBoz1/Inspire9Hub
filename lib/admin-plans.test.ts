import { describe, expect, it } from "vitest";
import { formatCentsAmount, membershipTotals, perMonth, planRows, priceLabel, toPlan, toPlanSubscription, type RawSubscription } from "./admin-plans";

const NOW = new Date("2026-09-20T02:00:00Z");
const later = new Date(NOW.getTime() + 10 * 86_400_000).toISOString();
const earlier = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const resident = toPlan({ id: "p1", slug: "resident", name: "Resident desk", stripe_price_id: "price_1", amount_cents: 45000, currency: "AUD", billing_interval: "month", active: true, sort_order: 1 });
const flexi = toPlan({ id: "p2", slug: "flexi", name: "Flexi", stripe_price_id: "price_2", amount_cents: 18000, currency: "aud", billing_interval: "month", active: true, sort_order: 2 });
const annual = toPlan({ id: "p3", slug: "resident-annual", name: "Resident, yearly", stripe_price_id: "price_3", amount_cents: 480000, currency: "aud", billing_interval: "year", active: true, sort_order: 3 });
const retired = toPlan({ id: "p4", slug: "resident", name: "Resident (old price)", stripe_price_id: "price_0", amount_cents: 40000, currency: "aud", billing_interval: "month", active: false });
const gone = toPlan({ id: "p5", slug: "hotdesk", name: "Old hot desk", stripe_price_id: "price_9", amount_cents: 9000, currency: "aud", billing_interval: "month", active: false });

const sub = (plan: string | null, over: Partial<RawSubscription> = {}) =>
  toPlanSubscription({ plan_id: plan, status: "active", current_period_end: later, unit_amount_cents: 45000, currency: "aud", billing_interval: "month", ...over });

describe("plans", () => {
  it("reads a plan with safe defaults", () => {
    expect(resident).toMatchObject({ currency: "aud", billingInterval: "month", intervalCount: 1, active: true });
    expect(toPlan({ id: "x", slug: "x", stripe_price_id: "p", amount_cents: 1, currency: "aud", billing_interval: "fortnight" }).billingInterval).toBe("month");
  });

  it("says prices the way people do", () => {
    expect(priceLabel(resident)).toBe("$450 a month");
    expect(priceLabel(annual)).toBe("$4,800 a year");
    expect(priceLabel({ amountCents: 120000, billingInterval: "month", intervalCount: 3 })).toBe("$1,200 every 3 months");
    expect(formatCentsAmount(4550)).toBe("$45.50");
    expect(perMonth(annual)).toBe(40000);
  });
});

describe("who's on each plan", () => {
  const subs = [
    sub("p1"),
    sub("p1", { cancel_at_period_end: true }),
    sub("p1", { status: "past_due", current_period_end: earlier(2) }),
    sub("p1", { status: "canceled", ended_at: earlier(20) }),
    sub("p2", { unit_amount_cents: 18000, status: "trialing" }),
    // Grandfathered: still on the old price, so the retired plan stays listed.
    sub("p4", { unit_amount_cents: 40000 }),
  ];

  it("counts current members, who's leaving, and what each plan brings in", () => {
    const rows = planRows([annual, flexi, resident, retired, gone], subs, NOW);
    expect(rows.map((r) => [r.plan.name, r.members, r.leaving, r.mrrCents])).toEqual([
      ["Resident desk", 3, 1, 135000],
      // A trial is a member, but not revenue yet.
      ["Flexi", 1, 0, 0],
      ["Resident, yearly", 0, 0, 0],
      // Retired, but someone is still on it, so it stays; the empty retired plan doesn't.
      ["Resident (old price)", 1, 0, 40000],
    ]);
  });

  it("adds up the totals across the top of the page", () => {
    const totals = membershipTotals([...subs, sub(null, { unit_amount_cents: 30000 })], NOW);
    expect(totals).toEqual({ members: 6, overdue: 1, leaving: 1, mrrCents: 45000 * 3 + 40000 + 30000, offPlan: 1 });
  });

  // Stripe keeps collecting until its retries run out, and counts it in MRR until then; so does this.
  it("stops counting a lapsed card as a member, but keeps it in MRR while Stripe is still collecting", () => {
    expect(membershipTotals([sub("p1", { status: "past_due", current_period_end: earlier(30) })], NOW)).toMatchObject({ members: 0, overdue: 0, mrrCents: 45000 });
  });
});
