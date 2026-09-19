import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_COLUMNS, toPlan, type Plan, type RawPlan } from "@/lib/admin-plans";
import { currentSubscription, type StripeSubscriptionStatus, type SubscriptionSnapshot } from "@/lib/billing/state";

/**
 * One member's billing, read with the service-role client because the billing
 * tables are closed to browsers. Every query is scoped to the member id the
 * page got from the signed-in session, never to anything in the URL.
 */

export type MemberSubscription = SubscriptionSnapshot & { id: string; planName: string | null; createdAt: string };
export type MemberInvoice = { id: string; status: string; amountPaidCents: number; amountDueCents: number; currency: string; periodStart: string; periodEnd: string; url: string | null };

export type MembershipPageData = {
  tableMissing: boolean;
  plans: Plan[];
  current: MemberSubscription | null;
  invoices: MemberInvoice[];
  hasCustomer: boolean;
};

const missing = (code?: string) => code === "PGRST205" || code === "42P01" || code === "42703";

export async function loadMembership(memberId: string): Promise<MembershipPageData> {
  const db = createAdminClient();
  const [plans, subs, member] = await Promise.all([
    db.from("plans").select(PLAN_COLUMNS).eq("active", true).order("sort_order", { ascending: true }),
    db
      .from("subscriptions")
      .select("id, status, cancel_at_period_end, current_period_end, ended_at, unit_amount_cents, quantity, currency, billing_interval, interval_count, created_at, plans(name)")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("members").select("stripe_customer_id").eq("id", memberId).maybeSingle(),
  ]);
  if (missing(plans.error?.code) || missing(subs.error?.code) || missing(member.error?.code)) {
    return { tableMissing: true, plans: [], current: null, invoices: [], hasCustomer: false };
  }
  // Thrown so the page shows its error screen, not "no membership" when there is one.
  for (const r of [plans, subs, member]) if (r.error) throw new Error(`[membership] load: ${r.error.message}`);

  const all: MemberSubscription[] = (subs.data ?? []).map((s) => {
    const plan = Array.isArray(s.plans) ? s.plans[0] : s.plans;
    return {
      id: s.id as string,
      status: s.status as StripeSubscriptionStatus,
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      currentPeriodEnd: (s.current_period_end as string | null) ?? null,
      endedAt: (s.ended_at as string | null) ?? null,
      unitAmountCents: s.unit_amount_cents as number,
      quantity: Math.max(1, (s.quantity as number | null) ?? 1),
      currency: (s.currency as string).toLowerCase(),
      billingInterval: s.billing_interval === "year" ? "year" : "month",
      intervalCount: Math.max(1, (s.interval_count as number | null) ?? 1),
      planName: (plan as { name?: string | null } | null)?.name?.trim() || null,
      createdAt: s.created_at as string,
    };
  });

  let invoices: MemberInvoice[] = [];
  if (all.length) {
    const { data, error } = await db
      .from("subscription_invoices")
      .select("id, status, amount_paid_cents, amount_due_cents, currency, period_start, period_end, hosted_invoice_url")
      .in("subscription_id", all.map((s) => s.id))
      .neq("status", "draft")
      .order("period_start", { ascending: false })
      .limit(12);
    if (error) throw new Error(`[membership] invoices: ${error.message}`);
    invoices = (data ?? []).map((i) => ({
      id: i.id as string,
      status: i.status as string,
      amountPaidCents: i.amount_paid_cents as number,
      amountDueCents: i.amount_due_cents as number,
      currency: (i.currency as string).toLowerCase(),
      periodStart: i.period_start as string,
      periodEnd: i.period_end as string,
      url: (i.hosted_invoice_url as string | null) ?? null,
    }));
  }

  return {
    tableMissing: false,
    plans: (plans.data ?? []).map((p) => toPlan(p as RawPlan)),
    current: currentSubscription(all),
    invoices,
    hasCustomer: Boolean(member.data?.stripe_customer_id),
  };
}
