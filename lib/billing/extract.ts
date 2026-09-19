import type Stripe from "stripe";
import { parseDiscount } from "./discount";

/**
 * Stripe objects to database rows. Pure, so the fiddly parts are pinned by
 * tests with plain objects and no network: where Stripe keeps a subscription's
 * period end now (on the item, not the subscription), which period an invoice
 * actually paid for (its lines, not its own period fields), and what to do with
 * shapes we can't store.
 *
 * Each function returns a row, or a reason to skip. A skip is logged and the
 * event acknowledged: retrying can't turn an unsupported object into a
 * supported one.
 */

export type Extracted<T> = { row: T; warnings: string[] } | { skip: string };
type EventStamp = { id: string | null; created: number };

const iso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);
const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Our member id, if we put one in the metadata. Anything that isn't a UUID is ignored. */
export function memberIdFrom(metadata: Stripe.Metadata | null | undefined): string | null {
  const value = metadata?.member_id;
  return typeof value === "string" && UUID.test(value) ? value : null;
}

/** Month or year only: that's all a coworking plan needs, and what the tables allow. */
function cycleOf(recurring: Stripe.Price.Recurring | null): { billing_interval: "month" | "year"; interval_count: number } | null {
  if (!recurring || (recurring.interval !== "month" && recurring.interval !== "year")) return null;
  return { billing_interval: recurring.interval, interval_count: Math.max(1, recurring.interval_count || 1) };
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export type SubscriptionRow = {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  ended_at: string | null;
  unit_amount_cents: number;
  currency: string;
  billing_interval: "month" | "year";
  interval_count: number;
  quantity: number;
  last_stripe_event_created: number;
  last_stripe_event_id: string | null;
};

export function toSubscriptionRow(sub: Stripe.Subscription, event: EventStamp): Extracted<SubscriptionRow> {
  const warnings: string[] = [];
  const item = sub.items?.data?.[0];
  if (!item) return { skip: `subscription ${sub.id} has no items` };
  if (sub.items.data.length > 1) warnings.push(`subscription ${sub.id} has ${sub.items.data.length} items; only the first is mirrored`);

  const price = item.price;
  const cycle = cycleOf(price.recurring);
  if (!cycle) return { skip: `subscription ${sub.id} bills by the ${price.recurring?.interval ?? "one-off"}, which plans don't support` };
  // A tiered or metered price has no single amount. Storing 0 under-reports MRR,
  // which someone will notice; dropping the row would hide a paying member.
  if (price.unit_amount === null) warnings.push(`subscription ${sub.id} has no unit amount; recorded as 0`);

  const customer = idOf(sub.customer);
  if (!customer) return { skip: `subscription ${sub.id} has no customer` };

  return {
    row: {
      stripe_subscription_id: sub.id,
      stripe_customer_id: customer,
      stripe_price_id: price.id,
      status: sub.status,
      // Stripe moved this onto the item; the subscription itself no longer has it.
      current_period_end: iso(item.current_period_end),
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      ended_at: iso(sub.ended_at),
      unit_amount_cents: price.unit_amount ?? 0,
      currency: (price.currency || sub.currency || "aud").toLowerCase(),
      ...cycle,
      quantity: Math.max(1, item.quantity ?? 1),
      last_stripe_event_created: event.created,
      last_stripe_event_id: event.id,
    },
    warnings,
  };
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export type InvoiceRow = {
  /** For finding the subscription row; not a column on subscription_invoices. */
  stripe_subscription_id: string;
  stripe_invoice_id: string;
  status: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  period_start: string;
  period_end: string;
  hosted_invoice_url: string | null;
  billing_reason: string | null;
  next_payment_attempt: string | null;
  last_stripe_event_created: number;
};

/**
 * The period an invoice paid FOR comes from its line items. The invoice's own
 * period_start and period_end "look back one period for a subscription invoice"
 * (Stripe's words), so a renewal for October would be labelled September.
 */
export function servicePeriod(invoice: Pick<Stripe.Invoice, "lines" | "period_start" | "period_end">): { start: number; end: number; fromLines: boolean } {
  const periods = (invoice.lines?.data ?? []).map((line) => line.period).filter((p): p is Stripe.InvoiceLineItem.Period => Boolean(p?.start && p?.end));
  if (periods.length === 0) return { start: invoice.period_start, end: invoice.period_end, fromLines: false };
  return { start: Math.min(...periods.map((p) => p.start)), end: Math.max(...periods.map((p) => p.end)), fromLines: true };
}

export function toInvoiceRow(invoice: Stripe.Invoice, event: EventStamp): Extracted<InvoiceRow> {
  const warnings: string[] = [];
  // One-off invoices and quotes aren't memberships: leave them alone.
  if (invoice.parent?.type !== "subscription_details" || !invoice.parent.subscription_details) return { skip: `invoice ${invoice.id} isn't for a subscription` };
  const subscription = idOf(invoice.parent.subscription_details.subscription);
  if (!subscription) return { skip: `invoice ${invoice.id} names no subscription` };
  if (!invoice.id) return { skip: "invoice has no id (a preview?)" };

  const period = servicePeriod(invoice);
  if (!period.fromLines) warnings.push(`invoice ${invoice.id} has no line periods; used the invoice's own, which may be a period early`);
  if (invoice.lines?.has_more) warnings.push(`invoice ${invoice.id} has more lines than the event carried; period taken from the first page`);

  return {
    row: {
      stripe_subscription_id: subscription,
      stripe_invoice_id: invoice.id,
      status: invoice.status ?? "draft",
      // Deliberately allowed to be negative: a mid-cycle downgrade is a credit.
      amount_due_cents: invoice.amount_due,
      amount_paid_cents: invoice.amount_paid,
      currency: (invoice.currency || "aud").toLowerCase(),
      period_start: iso(period.start)!,
      period_end: iso(period.end)!,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      billing_reason: invoice.billing_reason ?? null,
      next_payment_attempt: iso(invoice.next_payment_attempt),
      last_stripe_event_created: event.created,
    },
    warnings,
  };
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export type PlanRow = {
  slug: string;
  name: string;
  description: string | null;
  stripe_product_id: string;
  stripe_price_id: string;
  amount_cents: number;
  currency: string;
  billing_interval: "month" | "year";
  interval_count: number;
  active: boolean;
  sort_order: number;
  booking_discount_percent: number;
};

const productOf = (price: Stripe.Price): Stripe.Product | null =>
  typeof price.product === "object" && price.product && !("deleted" in price.product && price.product.deleted) ? (price.product as Stripe.Product) : null;

/**
 * A plan tag, read from the Price first and then its Product. Stripe's product
 * page shows metadata up front while a price's is tucked away, so staff reach
 * for the product; a tag on one price still wins, for a product sold two ways.
 */
function planTag(price: Stripe.Price, key: string): string | undefined {
  return price.metadata?.[key]?.trim() || productOf(price)?.metadata?.[key]?.trim() || undefined;
}

/** Whether staff tagged this price, or its product, as a plan to sell on the site. */
export function isTaggedPlan(price: Stripe.Price): boolean {
  return Boolean(planTag(price, "hub_plan_slug"));
}

/**
 * A Stripe Price becomes a plan only if someone tagged it, or its product, with
 * metadata.hub_plan_slug: that tag is how staff say "sell this on the site",
 * so an unrelated price in the same Stripe account never appears by accident.
 * Skip reasons are shown to staff, so they name the product and say what to do.
 */
export function toPlanRow(price: Stripe.Price): Extracted<PlanRow> {
  const product = productOf(price);
  if (!product) return { skip: `price ${price.id} came without its product (expand data.product)` };
  const label = `“${product.name.trim() || price.id}”`;
  const rawSlug = planTag(price, "hub_plan_slug");
  if (!rawSlug) return { skip: `${label} has no hub_plan_slug` };
  const slug = rawSlug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return { skip: `${label} has a hub_plan_slug with no letters or numbers in it` };
  if (!price.recurring) return { skip: `${label} has a one-off price. A membership needs a recurring price: in Stripe, add a monthly recurring price to it and archive the one-off one.` };
  const cycle = cycleOf(price.recurring);
  if (!cycle) return { skip: `${label} bills every ${price.recurring.interval}. Plans can be monthly or yearly.` };
  if (price.unit_amount === null) return { skip: `${label} has no fixed price. Plans need a set amount.` };

  const order = Number(planTag(price, "hub_sort_order"));
  return {
    row: {
      slug,
      name: product.name.trim() || slug,
      description: product.description?.trim() || null,
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      amount_cents: price.unit_amount,
      currency: price.currency.toLowerCase(),
      ...cycle,
      active: price.active && product.active,
      sort_order: Number.isFinite(order) ? order : 0,
      // Staff set this in Stripe too, as metadata.hub_booking_discount (a percentage).
      booking_discount_percent: parseDiscount(planTag(price, "hub_booking_discount")),
    },
    warnings: [],
  };
}

/**
 * What staff are told about a tagged price that couldn't become a plan, or null
 * when there's nothing to say. Stripe lists archived prices too, and those are
 * history rather than a problem: without this, archiving a price would never
 * clear the note about it. A one-off price sitting beside a plan the product
 * already sells only needs archiving, so that's all the note asks for.
 */
export function skipNote(price: Stripe.Price, reason: string, onSale: Pick<PlanRow, "stripe_product_id">[]): string | null {
  const product = productOf(price);
  if (!price.active || product?.active === false) return null;
  if (!price.recurring && product && onSale.some((plan) => plan.stripe_product_id === product.id)) {
    return `“${product.name.trim() || price.id}” also has a one-off price, which a plan can’t use. Archive it in Stripe to clear this note.`;
  }
  return reason;
}
