import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { isTaggedPlan, memberIdFrom, servicePeriod, toInvoiceRow, toPlanRow, toSubscriptionRow } from "./extract";

const EVENT = { id: "evt_1", created: 1_790_000_000 };
const MEMBER = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

const price = (over: Record<string, unknown> = {}) => ({
  id: "price_resident",
  active: true,
  currency: "AUD",
  unit_amount: 45000,
  recurring: { interval: "month", interval_count: 1 },
  metadata: { hub_plan_slug: "Resident Desk" },
  product: { id: "prod_1", name: "Resident desk", description: "Your own desk, every day", active: true },
  ...over,
});

const subscription = (over: Record<string, unknown> = {}, itemOver: Record<string, unknown> = {}) =>
  ({
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    ended_at: null,
    currency: "aud",
    metadata: { member_id: MEMBER },
    items: { data: [{ id: "si_1", current_period_start: 1_790_000_000, current_period_end: 1_792_592_000, quantity: 2, price: price(), ...itemOver }] },
    ...over,
  }) as unknown as Stripe.Subscription;

const invoice = (over: Record<string, unknown> = {}) =>
  ({
    id: "in_1",
    status: "paid",
    amount_due: 45000,
    amount_paid: 45000,
    currency: "aud",
    // Stripe's own period fields look back a period: these are September...
    period_start: 1_787_400_000,
    period_end: 1_790_000_000,
    hosted_invoice_url: "https://invoice.stripe.com/i/1",
    billing_reason: "subscription_cycle",
    next_payment_attempt: null,
    parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: null } },
    // ...while the line says what was paid for: October.
    lines: { data: [{ period: { start: 1_790_000_000, end: 1_792_592_000 } }], has_more: false },
    ...over,
  }) as unknown as Stripe.Invoice;

describe("subscriptions", () => {
  it("reads the period end from the item, where Stripe keeps it now", () => {
    const r = toSubscriptionRow(subscription(), EVENT);
    expect("row" in r && r.row).toMatchObject({
      stripe_subscription_id: "sub_1",
      stripe_customer_id: "cus_1",
      stripe_price_id: "price_resident",
      current_period_end: new Date(1_792_592_000 * 1000).toISOString(),
      unit_amount_cents: 45000,
      currency: "aud",
      billing_interval: "month",
      interval_count: 1,
      quantity: 2,
      last_stripe_event_created: EVENT.created,
      last_stripe_event_id: "evt_1",
    });
  });

  it("takes the customer id whether Stripe sent an id or the whole customer", () => {
    const r = toSubscriptionRow(subscription({ customer: { id: "cus_9", email: "a@b.co" } }), EVENT);
    expect("row" in r && r.row.stripe_customer_id).toBe("cus_9");
  });

  it("keeps a paying member even when the price has no single amount, and says so", () => {
    const r = toSubscriptionRow(subscription({}, { price: price({ unit_amount: null }) }), EVENT);
    expect("row" in r && r.row.unit_amount_cents).toBe(0);
    expect("row" in r && r.warnings[0]).toMatch(/no unit amount/);
  });

  it("warns about extra items instead of silently ignoring them", () => {
    const sub = subscription();
    sub.items.data.push({ ...sub.items.data[0], id: "si_2" });
    const r = toSubscriptionRow(sub, EVENT);
    expect("row" in r && r.warnings[0]).toMatch(/2 items/);
  });

  it("skips what can't be stored, with a reason", () => {
    expect(toSubscriptionRow(subscription({ items: { data: [] } }), EVENT)).toEqual({ skip: "subscription sub_1 has no items" });
    expect(toSubscriptionRow(subscription({}, { price: price({ recurring: { interval: "week", interval_count: 1 } }) }), EVENT)).toMatchObject({ skip: expect.stringMatching(/week/) });
  });

  it("stamps a finished subscription with when it ended", () => {
    const r = toSubscriptionRow(subscription({ status: "canceled", ended_at: 1_791_000_000 }), EVENT);
    expect("row" in r && [r.row.status, r.row.ended_at]).toEqual(["canceled", new Date(1_791_000_000 * 1000).toISOString()]);
  });
});

describe("invoices", () => {
  it("labels an invoice with the period it paid for, not the one before", () => {
    const r = toInvoiceRow(invoice(), EVENT);
    expect("row" in r && [r.row.period_start, r.row.period_end]).toEqual([new Date(1_790_000_000 * 1000).toISOString(), new Date(1_792_592_000 * 1000).toISOString()]);
  });

  it("spans every line on a plan-change invoice", () => {
    const lines = { data: [{ period: { start: 1_790_500_000, end: 1_792_592_000 } }, { period: { start: 1_790_000_000, end: 1_790_500_000 } }], has_more: false };
    expect(servicePeriod(invoice({ lines }) as Stripe.Invoice)).toEqual({ start: 1_790_000_000, end: 1_792_592_000, fromLines: true });
  });

  it("falls back to the invoice's own period, with a warning, when there are no lines", () => {
    const r = toInvoiceRow(invoice({ lines: { data: [], has_more: false } }), EVENT);
    expect("row" in r && r.warnings[0]).toMatch(/a period early/);
  });

  it("finds the subscription whether it came as an id or the whole object", () => {
    const r = toInvoiceRow(invoice({ parent: { type: "subscription_details", subscription_details: { subscription: { id: "sub_7" }, metadata: null } } }), EVENT);
    expect("row" in r && r.row.stripe_subscription_id).toBe("sub_7");
  });

  it("keeps a negative amount: a downgrade part-way through a month is a credit", () => {
    const r = toInvoiceRow(invoice({ amount_due: -12000, amount_paid: 0, billing_reason: "subscription_update", status: "paid" }), EVENT);
    expect("row" in r && [r.row.amount_due_cents, r.row.billing_reason]).toEqual([-12000, "subscription_update"]);
  });

  it("records when a failed payment will be tried again", () => {
    const r = toInvoiceRow(invoice({ status: "open", amount_paid: 0, next_payment_attempt: 1_790_300_000 }), EVENT);
    expect("row" in r && r.row.next_payment_attempt).toBe(new Date(1_790_300_000 * 1000).toISOString());
  });

  it("leaves one-off invoices and quotes alone", () => {
    expect(toInvoiceRow(invoice({ parent: null }), EVENT)).toMatchObject({ skip: expect.stringMatching(/isn't for a subscription/) });
    expect(toInvoiceRow(invoice({ parent: { type: "quote_details", quote_details: {}, subscription_details: null } }), EVENT)).toMatchObject({ skip: expect.any(String) });
  });
});

describe("plans", () => {
  it("turns a tagged price into a plan, tidying the slug", () => {
    const r = toPlanRow(price() as unknown as Stripe.Price);
    expect("row" in r && r.row).toEqual({
      slug: "resident-desk",
      name: "Resident desk",
      description: "Your own desk, every day",
      stripe_product_id: "prod_1",
      stripe_price_id: "price_resident",
      amount_cents: 45000,
      currency: "aud",
      billing_interval: "month",
      interval_count: 1,
      active: true,
      sort_order: 0,
      booking_discount_percent: 0,
    });
  });

  it("ignores prices nobody tagged for sale, and ones it can't sell", () => {
    expect(toPlanRow(price({ metadata: {} }) as unknown as Stripe.Price)).toMatchObject({ skip: expect.stringMatching(/no hub_plan_slug/) });
    expect(toPlanRow(price({ recurring: null }) as unknown as Stripe.Price)).toMatchObject({ skip: expect.stringMatching(/one-off price/) });
    expect(toPlanRow(price({ recurring: { interval: "week", interval_count: 1 } }) as unknown as Stripe.Price)).toMatchObject({ skip: expect.stringMatching(/monthly or yearly/) });
    expect(toPlanRow(price({ unit_amount: null }) as unknown as Stripe.Price)).toMatchObject({ skip: expect.stringMatching(/no fixed price/) });
    expect(toPlanRow(price({ product: "prod_1" }) as unknown as Stripe.Price)).toMatchObject({ skip: expect.stringMatching(/expand/) });
  });

  it("reads the member discount on bookings from the price, and ignores a silly one", () => {
    const r = toPlanRow(price({ metadata: { hub_plan_slug: "resident", hub_booking_discount: "20" } }) as unknown as Stripe.Price);
    expect("row" in r && r.row.booking_discount_percent).toBe(20);
    const silly = toPlanRow(price({ metadata: { hub_plan_slug: "resident", hub_booking_discount: "all of it" } }) as unknown as Stripe.Price);
    expect("row" in silly && silly.row.booking_discount_percent).toBe(0);
  });

  it("reads the tags from the product when the price has none", () => {
    const tagged = { id: "prod_1", name: "Resident desk", description: null, active: true, metadata: { hub_plan_slug: "resident", hub_booking_discount: "20", hub_sort_order: "2" } };
    const r = toPlanRow(price({ metadata: {}, product: tagged }) as unknown as Stripe.Price);
    expect("row" in r && [r.row.slug, r.row.booking_discount_percent, r.row.sort_order]).toEqual(["resident", 20, 2]);
    expect(isTaggedPlan(price({ metadata: {}, product: tagged }) as unknown as Stripe.Price)).toBe(true);
  });

  it("lets a tag on the price beat the one on its product", () => {
    const tagged = { id: "prod_1", name: "Resident desk", description: null, active: true, metadata: { hub_plan_slug: "resident", hub_booking_discount: "20" } };
    const r = toPlanRow(price({ metadata: { hub_plan_slug: "resident-yearly", hub_booking_discount: "25" }, product: tagged }) as unknown as Stripe.Price);
    expect("row" in r && [r.row.slug, r.row.booking_discount_percent]).toEqual(["resident-yearly", 25]);
  });

  it("says, by product name, why a tagged one-off price can't be a plan", () => {
    const tagged = { id: "prod_1", name: "Resident desk", description: null, active: true, metadata: { hub_plan_slug: "resident" } };
    const r = toPlanRow(price({ metadata: {}, recurring: null, product: tagged }) as unknown as Stripe.Price);
    expect(r).toMatchObject({ skip: expect.stringMatching(/^“Resident desk” has a one-off price\. .*recurring/) });
  });

  it("leaves untagged prices out without a word", () => {
    expect(isTaggedPlan(price({ metadata: {} }) as unknown as Stripe.Price)).toBe(false);
    expect(isTaggedPlan(price({ metadata: { hub_plan_slug: "  " } }) as unknown as Stripe.Price)).toBe(false);
    expect(isTaggedPlan(price({ metadata: {}, product: "prod_1" }) as unknown as Stripe.Price)).toBe(false);
  });

  it("switches a plan off when its price or product has been archived", () => {
    const r = toPlanRow(price({ active: false }) as unknown as Stripe.Price);
    expect("row" in r && r.row.active).toBe(false);
  });
});

describe("member ids from metadata", () => {
  it("only trusts something shaped like our ids", () => {
    expect(memberIdFrom({ member_id: MEMBER })).toBe(MEMBER);
    expect(memberIdFrom({ member_id: "1 OR 1=1" })).toBeNull();
    expect(memberIdFrom(null)).toBeNull();
  });
});
