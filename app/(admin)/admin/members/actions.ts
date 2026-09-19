"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { isUuid } from "@/lib/admin-compliance";
import { toMemberDetails, type MemberDetails, type RawMemberDetails } from "@/lib/admin-members";

export type MemberDetailsResult = { error: string } | { details: MemberDetails };

/** A member's history, including their medical details, so only admins may ask for it. */
export async function getMemberDetails(memberId: string): Promise<MemberDetailsResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error ?? "Only admins can do that." };
  if (!isUuid(memberId)) return { error: "That member couldn’t be found." };

  const supabase = createAdminClient();
  const [induction, bookings, payments, passes, subscriptions] = await Promise.all([
    supabase
      .from("induction_records")
      .select("completion_date, acknowledged_terms, health_emergency_info")
      .eq("member_id", memberId)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id, start_date_time, end_date_time, booking_status, workspaces(name)")
      .eq("member_id", memberId)
      .order("start_date_time", { ascending: false })
      .limit(20),
    supabase
      .from("payments")
      .select("id, amount, refunded_amount, payment_date, payment_status, payment_method")
      .eq("member_id", memberId)
      .order("payment_date", { ascending: false })
      .limit(20),
    supabase
      .from("access_passes")
      .select("id, issued_date, expiry_date, pass_type, pass_status")
      .eq("member_id", memberId)
      .order("issued_date", { ascending: false })
      .limit(10),
    supabase
      .from("subscriptions")
      .select("plan_id, status, cancel_at_period_end, current_period_end, ended_at, unit_amount_cents, quantity, currency, billing_interval, interval_count, created_at, plans(name)")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const failed = [induction, bookings, payments, passes].find((r) => r.error);
  if (failed?.error) {
    console.error("[members] details:", failed.error.message);
    return { error: "Couldn’t load this member’s details. Please try again." };
  }

  return {
    details: toMemberDetails({
      induction: induction.data,
      bookings: bookings.data ?? [],
      payments: payments.data ?? [],
      passes: passes.data ?? [],
      // Billing is optional: before its migration there's no table, and that's not an error here.
      subscriptions: subscriptions.error ? [] : (subscriptions.data ?? []),
    } as unknown as RawMemberDetails),
  };
}
