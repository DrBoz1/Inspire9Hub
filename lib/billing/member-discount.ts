import { createAdminClient } from "@/lib/supabase/admin";
import { parseDiscount } from "./discount";
import { hasHubAccess, membershipState, type StripeSubscriptionStatus } from "./state";

/**
 * The percentage a member gets off room bookings right now, from the plan
 * they're on. Server only. Nothing the browser sends is involved.
 *
 * Anything uncertain means no discount: no billing tables yet, no membership, a
 * lapsed one, or a failed read. Charging the full price is the safe mistake;
 * the member can be refunded the difference, and nothing is ever under-charged
 * by accident.
 */
export async function memberDiscountPercent(memberId: string, now = new Date()): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .select("status, current_period_end, plans(booking_discount_percent)")
    .eq("member_id", memberId)
    .in("status", ["trialing", "active", "past_due"])
    .limit(1);
  if (error) {
    if (error.code !== "PGRST205" && error.code !== "42P01") console.error("[billing] member discount:", error.message);
    return 0;
  }
  const sub = data?.[0];
  if (!sub) return 0;
  const state = membershipState({ status: sub.status as StripeSubscriptionStatus, currentPeriodEnd: (sub.current_period_end as string | null) ?? null }, now);
  if (!hasHubAccess(state)) return 0;
  const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans;
  return parseDiscount((plan as { booking_discount_percent?: number | null } | null)?.booking_discount_percent);
}
