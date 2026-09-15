import { createAdminClient } from "@/lib/supabase/admin";
import {
  sortStaff,
  toCandidate,
  toStaffMember,
  type RawCandidate,
  type RawStaff,
  type StaffCandidate,
  type StaffMember,
} from "@/lib/admin-staff";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Deleting a login in the Supabase Auth dashboard can leave its admins row behind.
 * Every row is checked against Auth so those show up as leftovers, not as staff.
 * Read-only: the proxy guards the page, and every change re-checks the caller.
 */
export async function loadStaff(db: Db = createAdminClient()): Promise<StaffMember[]> {
  const { data, error } = await db.from("admins").select("id, full_name, email, role");
  // Thrown so the page shows its error screen, not an empty roster that looks real.
  if (error) throw new Error(`[staff] load: ${error.message}`);

  const staff = await Promise.all(
    ((data ?? []) as RawStaff[]).map(async (row) => {
      const { data: auth, error: authError } = await db.auth.admin.getUserById(row.id);
      // Only a clear "not found" counts as a missing login; a hiccup shouldn't flag real staff.
      const exists = Boolean(auth?.user) || (Boolean(authError) && authError?.status !== 404);
      return toStaffMember(row, { exists, email: auth?.user?.email });
    }),
  );
  return sortStaff(staff);
}

/** People with a hub account who aren't staff yet. */
export async function loadCandidates(staffIds: string[], db: Db = createAdminClient()): Promise<StaffCandidate[]> {
  const { data, error } = await db.from("members").select("id, full_name, email, company_name").order("full_name", { ascending: true });
  if (error) throw new Error(`[staff] candidates: ${error.message}`);
  const taken = new Set(staffIds);
  return ((data ?? []) as RawCandidate[]).filter((m) => !taken.has(m.id)).map(toCandidate);
}
