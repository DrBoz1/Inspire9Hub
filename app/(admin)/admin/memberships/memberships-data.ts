import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_COLUMNS, SUBSCRIPTION_COLUMNS, toPlan, toPlanSubscription, type Plan, type PlanSubscription, type RawPlan, type RawSubscription } from "@/lib/admin-plans";

/** Read-only. The admin proxy guards the page. */

export type MembershipsData = {
  plans: Plan[];
  subscriptions: PlanSubscription[];
  /** add_membership_billing.sql hasn't been run: the page explains instead of erroring. */
  tableMissing: boolean;
};

const missingTable = (code?: string) => code === "PGRST205" || code === "42P01";

export async function loadMemberships(): Promise<MembershipsData> {
  const db = createAdminClient();
  const [plans, subs] = await Promise.all([
    db.from("plans").select(PLAN_COLUMNS).order("sort_order", { ascending: true }),
    // Everyone who has ever subscribed is a few hundred rows at most for one hub.
    db.from("subscriptions").select(SUBSCRIPTION_COLUMNS).limit(5000),
  ]);
  if (missingTable(plans.error?.code) || missingTable(subs.error?.code)) return { plans: [], subscriptions: [], tableMissing: true };
  // Thrown so the page shows its error screen, not empty numbers that look real.
  if (plans.error) throw new Error(`[memberships] plans: ${plans.error.message}`);
  if (subs.error) throw new Error(`[memberships] subscriptions: ${subs.error.message}`);
  return {
    plans: (plans.data ?? []).map((p) => toPlan(p as RawPlan)),
    subscriptions: (subs.data ?? []).map((s) => toPlanSubscription(s as RawSubscription)),
    tableMissing: false,
  };
}
