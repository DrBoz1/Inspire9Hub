import { afterEach, describe, expect, it, vi } from "vitest";
import {
  durationLabel,
  filterConditions,
  formatMoney,
  groupByDay,
  refundQuote,
  sanitizeSearch,
  scheduleActions,
  scheduleFilter,
  scheduleHref,
  summarisePayments,
  toScheduleRow,
  type ScheduleRow,
} from "./admin-bookings";

// Tuesday 15 September 2026, 2:30pm in Melbourne (UTC+10).
const NOW = new Date("2026-09-15T04:30:00Z");
const row = (o: Partial<ScheduleRow> = {}): ScheduleRow => ({
  id: "b1", start: "2026-09-16T00:00:00Z", end: "2026-09-16T02:00:00Z", status: "confirmed", room: "Dream Room", location: "Level 1",
  member: "Alex Chen", email: "alex@northwind.com", payment: { state: "paid", amount: 24, refunded: null, canRefundOnline: true }, ...o,
});

describe("filters, search and links", () => {
  it("defaults to upcoming", () => {
    expect([scheduleFilter("past"), scheduleFilter("today"), scheduleFilter("nope"), scheduleFilter(undefined)]).toEqual(["past", "today", "upcoming", "upcoming"]);
  });

  it("turns each filter into query conditions", () => {
    const b = { now: "N", dayStart: "S", dayEnd: "E" };
    expect(filterConditions("upcoming", b)).toEqual([{ op: "gte", column: "start_date_time", value: "N" }, { op: "neq", column: "booking_status", value: "cancelled" }]);
    expect(filterConditions("today", b)).toEqual([{ op: "lt", column: "start_date_time", value: "E" }, { op: "gt", column: "end_date_time", value: "S" }]);
    expect(filterConditions("past", b)).toEqual([{ op: "lt", column: "start_date_time", value: "N" }]);
    expect(filterConditions("cancelled", b)).toEqual([{ op: "eq", column: "booking_status", value: "cancelled" }]);
    expect(filterConditions("all", b)).toEqual([]);
  });

  it("strips anything that could break the search filter", () => {
    expect(sanitizeSearch("  alex, chen (north)%*\\ ")).toBe("alex chen north");
    expect(sanitizeSearch("x".repeat(80))).toHaveLength(60);
    expect(sanitizeSearch(undefined)).toBe("");
  });

  it("builds links without the defaults", () => {
    expect(scheduleHref({})).toBe("/admin/bookings");
    expect(scheduleHref({ filter: "cancelled", q: "alex", page: 2 })).toBe("/admin/bookings?filter=cancelled&q=alex&page=2");
    expect(scheduleHref({ filter: "upcoming", page: 1 })).toBe("/admin/bookings");
  });
});

describe("payments", () => {
  it("prefers a paid payment, then a refunded one", () => {
    expect(summarisePayments([{ payment_status: "failed", amount: 24 }, { payment_status: "paid", amount: "24.5", stripe_payment_intent_id: "pi_1" }]))
      .toEqual({ state: "paid", amount: 24.5, refunded: null, canRefundOnline: true });
    expect(summarisePayments({ payment_status: "refunded", amount: 24, refunded_amount: 12 })).toEqual({ state: "refunded", amount: 24, refunded: 12, canRefundOnline: false });
    expect(summarisePayments(null)).toEqual({ state: "unpaid", amount: null, refunded: null, canRefundOnline: false });
  });

  it("knows a payment without a Stripe record can't be refunded automatically", () => {
    expect(summarisePayments([{ payment_status: "paid", amount: 24, stripe_payment_intent_id: null }]).canRefundOnline).toBe(false);
  });

  it("reads a booking row and keeps the payment id out of it", () => {
    const r = toScheduleRow({ id: "b1", start_date_time: "s", end_date_time: "e", booking_status: "confirmed", workspaces: [{ name: "Dream Room", location: " " }], members: { full_name: "Alex", email: "a@x.com" }, payments: [{ payment_status: "paid", amount: 24, stripe_payment_intent_id: "pi_secret" }] });
    expect(r).toMatchObject({ room: "Dream Room", location: null, member: "Alex", payment: { state: "paid", canRefundOnline: true } });
    expect(JSON.stringify(r)).not.toContain("pi_secret");
  });
});

describe("what an admin can do", () => {
  it("cancels future bookings, refunds only when paid", () => {
    expect(scheduleActions(row(), NOW)).toEqual({ cancel: true, cancelAndRefund: true, refund: false, refundOffline: false });
    expect(scheduleActions(row({ payment: { state: "unpaid", amount: null, refunded: null, canRefundOnline: false } }), NOW)).toMatchObject({ cancel: true, cancelAndRefund: false });
  });

  it("doesn't cancel what has started or is already cancelled", () => {
    expect(scheduleActions(row({ start: "2026-09-15T04:00:00Z" }), NOW).cancel).toBe(false);
    expect(scheduleActions(row({ status: "cancelled" }), NOW)).toEqual({ cancel: false, cancelAndRefund: false, refund: true, refundOffline: false });
  });

  it("lets an admin retry a member's refund that failed", () => {
    const failed = summarisePayments([{ payment_status: "refund_failed", amount: 24, stripe_payment_intent_id: "pi_1" }]);
    expect(failed).toEqual({ state: "refund_failed", amount: 24, refunded: null, canRefundOnline: true });
    expect(scheduleActions(row({ status: "cancelled", payment: failed }), NOW)).toMatchObject({ refund: true, refundOffline: false });
  });

  it("points to Stripe when there's no online payment to refund", () => {
    expect(scheduleActions(row({ status: "cancelled", payment: { state: "paid", amount: 24, refunded: null, canRefundOnline: false } }), NOW)).toMatchObject({ refund: false, refundOffline: true });
    expect(scheduleActions(row({ status: "cancelled", payment: { state: "refunded", amount: 24, refunded: 24, canRefundOnline: false } }), NOW)).toMatchObject({ refund: false, refundOffline: false });
  });

  it("quotes the refund from the policy", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(refundQuote(row({ start: "2026-09-18T04:30:00Z", payment: { state: "paid", amount: 24.5, refunded: null, canRefundOnline: true } }))).toMatchObject({ percent: 100, cents: 2450 });
    expect(refundQuote(row({ start: "2026-09-15T16:30:00Z", payment: { state: "paid", amount: 24.5, refunded: null, canRefundOnline: true } }))).toMatchObject({ percent: 50, cents: 1225 });
    expect(refundQuote(row({ start: "2026-09-15T05:30:00Z" }))).toMatchObject({ percent: 0, cents: 0 });
  });
  afterEach(() => vi.useRealTimers());
});

describe("formatting and grouping", () => {
  it("formats money and durations", () => {
    expect([formatMoney(24), formatMoney(12.5), formatMoney(null)]).toEqual(["$24.00", "$12.50", "—"]);
    expect([durationLabel("2026-09-16T00:00:00Z", "2026-09-16T00:45:00Z"), durationLabel("2026-09-16T00:00:00Z", "2026-09-16T02:00:00Z"), durationLabel("2026-09-16T00:00:00Z", "2026-09-16T01:30:00Z")])
      .toEqual(["45 min", "2 h", "1 h 30 min"]);
  });

  it("groups by Melbourne day with friendly names", () => {
    const groups = groupByDay([
      row({ id: "a", start: "2026-09-15T01:00:00Z" }),
      row({ id: "b", start: "2026-09-15T13:30:00Z" }), // 11:30pm Tuesday in Melbourne
      row({ id: "c", start: "2026-09-15T14:30:00Z" }), // 12:30am Wednesday
      row({ id: "d", start: "2026-09-14T02:00:00Z" }),
      row({ id: "e", start: "2026-09-20T02:00:00Z" }),
      row({ id: "f", start: "2027-01-05T02:00:00Z" }),
    ], NOW);
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.id).join("")])).toEqual([
      ["Today", "ab"], ["Tomorrow", "c"], ["Yesterday", "d"], ["Sunday 20 September", "e"], ["Tuesday 5 January 2027", "f"],
    ]);
    expect(groups[0].date).toBe("Tuesday 15 September");
  });
});
