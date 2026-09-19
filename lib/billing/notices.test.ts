import { describe, expect, it } from "vitest";
import { invoiceNotices, NEWS_DAYS, subscriptionNotices, type InvoiceNews, type SubscriptionNews } from "./notices";

const NOW = new Date("2026-09-20T02:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const sub = (over: Partial<SubscriptionNews> = {}): SubscriptionNews => ({
  stripeSubscriptionId: "sub_1",
  memberId: "m1",
  planId: "p1",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: inDays(30),
  endedAt: null,
  startedAt: daysAgo(0),
  unitAmountCents: 7500,
  quantity: 1,
  billingInterval: "month",
  intervalCount: 1,
  ...over,
});

const invoice = (over: Partial<InvoiceNews> = {}): InvoiceNews => ({
  subscriptionRowId: "row1",
  stripeInvoiceId: "in_1",
  status: "paid",
  amountPaidCents: 7500,
  amountDueCents: 7500,
  periodStart: daysAgo(0),
  periodEnd: inDays(30),
  hostedInvoiceUrl: "https://invoice.stripe.com/i/1",
  number: "ABC-0001",
  nextPaymentAttempt: null,
  ...over,
});

const kinds = (notices: { kind: string }[]) => notices.map((n) => n.kind);

describe("membership emails from a subscription", () => {
  it("welcomes a member who has just joined, once per subscription", () => {
    expect(subscriptionNotices(sub(), NOW)).toEqual([{ kind: "welcome", key: "membership.welcome:sub_1" }]);
    // The same answer every time it's asked, so repeated events share one key.
    expect(subscriptionNotices(sub(), NOW)).toEqual(subscriptionNotices(sub(), NOW));
  });

  it("doesn't welcome someone who joined before these emails existed", () => {
    expect(subscriptionNotices(sub({ startedAt: daysAgo(NEWS_DAYS + 1) }), NOW)).toEqual([]);
    expect(kinds(subscriptionNotices(sub({ startedAt: daysAgo(NEWS_DAYS - 1) }), NOW))).toEqual(["welcome"]);
  });

  it("doesn't welcome a membership that never got going", () => {
    for (const status of ["incomplete", "incomplete_expired", "unpaid", "paused"] as const) {
      expect(subscriptionNotices(sub({ status }), NOW)).toEqual([]);
    }
  });

  it("confirms a cancellation with the date access ends, keyed by that date", () => {
    const end = inDays(12);
    const notices = subscriptionNotices(sub({ startedAt: daysAgo(40), cancelAtPeriodEnd: true, currentPeriodEnd: end }), NOW);
    expect(notices).toEqual([{ kind: "cancelling", key: `membership.cancelling:sub_1:${end}` }]);
    // Resumed, then cancelled again next period: a different end date, so it's news again.
    const later = subscriptionNotices(sub({ startedAt: daysAgo(70), cancelAtPeriodEnd: true, currentPeriodEnd: inDays(42) }), NOW);
    expect(later[0].key).not.toBe(notices[0].key);
  });

  it("sends both when someone joins and cancels before the first event lands", () => {
    expect(kinds(subscriptionNotices(sub({ cancelAtPeriodEnd: true }), NOW))).toEqual(["welcome", "cancelling"]);
  });

  it("says goodbye when it ends, but not for one that ended long ago", () => {
    expect(subscriptionNotices(sub({ status: "canceled", startedAt: daysAgo(90), endedAt: daysAgo(0) }), NOW)).toEqual([{ kind: "ended", key: "membership.ended:sub_1" }]);
    expect(subscriptionNotices(sub({ status: "canceled", startedAt: daysAgo(400), endedAt: daysAgo(200) }), NOW)).toEqual([]);
  });

  it("never welcomes a membership that has already ended", () => {
    expect(kinds(subscriptionNotices(sub({ status: "canceled", endedAt: daysAgo(0) }), NOW))).toEqual(["ended"]);
  });
});

describe("membership emails from an invoice", () => {
  it("sends a receipt for a paid invoice, once per invoice", () => {
    expect(invoiceNotices("invoice.paid", invoice())).toEqual([{ kind: "receipt", key: "membership.receipt:in_1" }]);
  });

  it("sends no receipt for nothing paid", () => {
    expect(invoiceNotices("invoice.paid", invoice({ amountPaidCents: 0 }))).toEqual([]);
  });

  it("warns once per invoice when a payment fails, however many retries", () => {
    const failed = invoice({ status: "open", amountPaidCents: 0, nextPaymentAttempt: inDays(3) });
    expect(invoiceNotices("invoice.payment_failed", failed)).toEqual([{ kind: "payment_failed", key: "membership.payment_failed:in_1" }]);
  });

  it("ignores invoice events that aren't a payment or a failure", () => {
    expect(invoiceNotices("invoice.finalized", invoice())).toEqual([]);
  });
});
