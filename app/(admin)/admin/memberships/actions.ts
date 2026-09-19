"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { syncPlans } from "@/lib/billing/sync";

export type SyncPlansResult = { error: string } | { saved: number; switchedOff: number; skipped: string[] };

/**
 * Copies the plans on sale from Stripe. Prices are only ever set in Stripe;
 * this makes the site match. Problems come back as values: Next hides thrown
 * messages in production.
 */
export async function syncPlansFromStripe(): Promise<SyncPlansResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error ?? "Only admins can do that." };

  const result = await syncPlans();
  if ("error" in result) return result;

  await recordAudit({
    actor: { id: guard.user.id, email: guard.user.email },
    action: "plans.sync",
    entity: "plan",
    summary: `Synced plans from Stripe: ${result.saved} read, ${result.switchedOff} switched off`,
    meta: { skipped: result.skipped },
  });
  revalidatePath("/admin/memberships");
  return result;
}
