import { hasHubAccess, membershipState, monthlyCents, mrrCents, type StripeSubscriptionStatus, type SubscriptionSnapshot } from "@/lib/billing/state";

/** The admin memberships page: plans on sale, and who's on them. Pure; `now` passed in. */

export const PLAN_COLUMNS = "id, slug, name, description, stripe_price_id, amount_cents, currency, billing_interval, interval_count, active, sort_order, booking_discount_percent";
export const SUBSCRIPTION_COLUMNS = "plan_id, status, cancel_at_period_end, current_period_end, ended_at, unit_amount_cents, quantity, currency, billing_interval, interval_count";

export type RawPlan = {
  id: string;
  slug: string;
  name?: string | null;
  description?: string | null;
  stripe_price_id: string;
  amount_cents: number;
  currency: string;
  billing_interval: string;
  interval_count?: number | null;
  active?: boolean | null;
  sort_order?: number | null;
  booking_discount_percent?: number | null;
};
export type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  stripePriceId: string;
  amountCents: number;
  currency: string;
  billingInterval: "month" | "year";
  intervalCount: number;
  active: boolean;
  sortOrder: number;
  /** Off room bookings while on this plan. */
  bookingDiscountPercent: number;
};

export type RawSubscription = {
  plan_id?: string | null;
  status: string;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
  ended_at?: string | null;
  unit_amount_cents: number;
  quantity?: number | null;
  currency: string;
  billing_interval: string;
  interval_count?: number | null;
};
export type PlanSubscription = SubscriptionSnapshot & { planId: string | null };

const interval = (value: string): "month" | "year" => (value === "year" ? "year" : "month");

export function toPlan(raw: RawPlan): Plan {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name?.trim() || raw.slug,
    description: raw.description?.trim() || null,
    stripePriceId: raw.stripe_price_id,
    amountCents: raw.amount_cents,
    currency: raw.currency.toLowerCase(),
    billingInterval: interval(raw.billing_interval),
    intervalCount: Math.max(1, raw.interval_count ?? 1),
    active: raw.active !== false,
    sortOrder: raw.sort_order ?? 0,
    bookingDiscountPercent: Math.min(100, Math.max(0, raw.booking_discount_percent ?? 0)),
  };
}

export function toPlanSubscription(raw: RawSubscription): PlanSubscription {
  return {
    planId: raw.plan_id ?? null,
    status: raw.status as StripeSubscriptionStatus,
    cancelAtPeriodEnd: Boolean(raw.cancel_at_period_end),
    currentPeriodEnd: raw.current_period_end ?? null,
    endedAt: raw.ended_at ?? null,
    unitAmountCents: raw.unit_amount_cents,
    quantity: Math.max(1, raw.quantity ?? 1),
    currency: raw.currency.toLowerCase(),
    billingInterval: interval(raw.billing_interval),
    intervalCount: Math.max(1, raw.interval_count ?? 1),
  };
}

const group = (whole: number) => String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** "$450", or "$450.50" when there are cents. */
export function formatCentsAmount(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const text = Number.isInteger(dollars) ? group(dollars) : `${group(Math.floor(dollars))}.${String(Math.round((dollars % 1) * 100)).padStart(2, "0")}`;
  return `${cents < 0 ? "-" : ""}$${text}`;
}

/** "$450 a month", "$4,800 a year", "$1,200 every 3 months". */
export function priceLabel(plan: Pick<Plan, "amountCents" | "billingInterval" | "intervalCount">): string {
  const unit = plan.billingInterval;
  const every = plan.intervalCount === 1 ? `a ${unit}` : `every ${plan.intervalCount} ${unit}s`;
  return `${formatCentsAmount(plan.amountCents)} ${every}`;
}

export type PlanRow = { plan: Plan; members: number; leaving: number; mrrCents: number };

/**
 * Each plan with who's on it. "Members" means they can use the hub right now
 * (active, a trial, or a failed payment still in its grace period); "leaving"
 * means they've cancelled but have paid until the end of the period. Plans on
 * sale first, in their set order; retired ones after, while anyone's still on them.
 */
export function planRows(plans: Plan[], subs: PlanSubscription[], now: Date): PlanRow[] {
  return plans
    .map((plan) => {
      const mine = subs.filter((s) => s.planId === plan.id);
      const live = mine.filter((s) => hasHubAccess(membershipState(s, now)));
      return {
        plan,
        members: live.length,
        leaving: live.filter((s) => s.cancelAtPeriodEnd).length,
        mrrCents: mrrCents(mine, plan.currency),
      };
    })
    .filter((row) => row.plan.active || row.members > 0)
    .sort((a, b) => Number(b.plan.active) - Number(a.plan.active) || a.plan.sortOrder - b.plan.sortOrder || a.plan.amountCents - b.plan.amountCents);
}

export type MembershipTotals = { members: number; overdue: number; leaving: number; mrrCents: number; offPlan: number };

/** The numbers across the top of the page, in one currency. */
export function membershipTotals(subs: PlanSubscription[], now: Date, currency = "aud"): MembershipTotals {
  const states = subs.map((s) => ({ s, state: membershipState(s, now) }));
  const live = states.filter(({ state }) => hasHubAccess(state));
  return {
    members: live.length,
    overdue: states.filter(({ state }) => state === "grace").length,
    leaving: live.filter(({ s }) => s.cancelAtPeriodEnd).length,
    mrrCents: mrrCents(subs, currency),
    // Paying through a price that isn't one of the plans, e.g. set up by hand in Stripe.
    offPlan: live.filter(({ s }) => s.planId === null).length,
  };
}

/** A plan's price as a monthly figure, for comparing monthly and yearly plans side by side. */
export const perMonth = (plan: Pick<Plan, "amountCents" | "billingInterval" | "intervalCount">) =>
  monthlyCents({ unitAmountCents: plan.amountCents, quantity: 1, billingInterval: plan.billingInterval, intervalCount: plan.intervalCount });
