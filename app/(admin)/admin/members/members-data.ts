import { createAdminClient } from "@/lib/supabase/admin";
import { toMemberRow, type MemberRow, type RawMember } from "@/lib/admin-members";

/**
 * Read-only. The admin proxy guards the route. Medical details stay out of the list:
 * they load one member at a time, through the guarded details action.
 */
export async function loadMembers(): Promise<MemberRow[]> {
  const { data, error } = await createAdminClient()
    .from("members")
    .select("id, full_name, email, company_name, mobile_number, member_status, induction_status")
    .order("full_name", { ascending: true });
  if (error) console.error("[members] load:", error.message);
  return ((data ?? []) as RawMember[]).map(toMemberRow);
}
