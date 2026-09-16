"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, type AdminRole } from "@/lib/admin-guard";
import { isUuid } from "@/lib/admin-compliance";
import { isAdminRole, removeBlocker, roleChangeBlocker, toStaffMember, type RawStaff, type StaffMember } from "@/lib/admin-staff";
import { recordAudit } from "@/lib/audit";
import { loadStaff } from "./staff-data";

export type StaffResult = { error?: string; saved?: StaffMember };

// Only super admins manage staff. A server action is a public endpoint, so each one checks
// the caller itself, and problems come back as values: Next hides thrown messages in production.
const MISSING = "That person couldn’t be found. Refresh the page and try again.";
const STAFF_COLUMNS = "id, full_name, email, role";

const roleLabel = (role: AdminRole) => (role === "super_admin" ? "super admin" : "admin");

async function signedInSuperAdmin() {
  const auth = await requireAdmin(["super_admin"]);
  return "error" in auth
    ? { error: auth.error ?? "Only a super admin can do that." }
    : { userId: auth.user.id, actor: { id: auth.user.id, email: auth.user.email } };
}

function refresh() {
  revalidatePath("/admin/management");
  revalidatePath("/admin", "layout");
}

export async function addStaff(memberId: string, role: AdminRole): Promise<StaffResult> {
  const auth = await signedInSuperAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!isUuid(memberId)) return { error: MISSING };
  if (!isAdminRole(role)) return { error: "Choose an access level." };

  const db = createAdminClient();
  const [{ data: member, error: memberError }, { data: existing }, { data: login }] = await Promise.all([
    db.from("members").select("full_name, email").eq("id", memberId).maybeSingle(),
    db.from("admins").select("id").eq("id", memberId).maybeSingle(),
    db.auth.admin.getUserById(memberId),
  ]);
  if (memberError) {
    console.error("[staff] add:", memberError.message);
    return { error: "Couldn’t add them. Please try again." };
  }
  if (!member) return { error: "Only people with a hub account can be added." };
  if (existing) return { error: "They already have admin access." };
  if (!login?.user) return { error: "Their login no longer exists, so they can’t be added." };

  const { data, error } = await db
    .from("admins")
    .insert({ id: memberId, full_name: member.full_name?.trim() || "Unnamed", email: login.user.email ?? member.email, role, active_status: "Active" })
    .select(STAFF_COLUMNS)
    .single();
  if (error) {
    console.error("[staff] add:", error.message);
    return { error: "Couldn’t add them. Please try again." };
  }

  await recordAudit({
    actor: auth.actor,
    action: "staff.add",
    entity: "staff",
    entityId: memberId,
    summary: `Gave ${member.full_name?.trim() || login.user.email || "a member"} ${roleLabel(role)} access`,
    meta: { role },
  });

  refresh();
  return { saved: toStaffMember(data as RawStaff, { exists: true, email: login.user.email }) };
}

export async function changeStaffRole(adminId: string, role: AdminRole): Promise<StaffResult> {
  const auth = await signedInSuperAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!isUuid(adminId)) return { error: MISSING };
  if (!isAdminRole(role)) return { error: "Choose an access level." };

  const db = createAdminClient();
  const staff = await loadStaff(db);
  const target = staff.find((s) => s.id === adminId);
  if (!target) return { error: MISSING };
  const blocked = roleChangeBlocker(target, role, staff, auth.userId);
  if (blocked) return { error: blocked };

  const { data, error } = await db.from("admins").update({ role }).eq("id", adminId).select(STAFF_COLUMNS).maybeSingle();
  if (error) {
    console.error("[staff] role:", error.message);
    return { error: "Couldn’t change their access. Please try again." };
  }
  if (!data) return { error: MISSING };

  // super_admins is an old tier marker nothing reads any more; don't leave one behind on a demotion.
  if (role === "admin") {
    const { error: markerError } = await db.from("super_admins").delete().eq("admin_id", adminId);
    if (markerError) console.error("[staff] role marker:", markerError.message);
  }

  await recordAudit({
    actor: auth.actor,
    action: "staff.role_change",
    entity: "staff",
    entityId: adminId,
    summary: `Changed ${target.name} from ${roleLabel(target.role)} to ${roleLabel(role)}`,
    meta: { from: target.role, to: role },
  });

  refresh();
  return { saved: toStaffMember(data as RawStaff, { exists: target.hasLogin, email: target.email }) };
}

export async function removeStaff(adminId: string): Promise<{ error?: string }> {
  const auth = await signedInSuperAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!isUuid(adminId)) return { error: MISSING };

  const db = createAdminClient();
  const staff = await loadStaff(db);
  const target = staff.find((s) => s.id === adminId);
  if (!target) return { error: MISSING };
  const blocked = removeBlocker(target, staff, auth.userId);
  if (blocked) return { error: blocked };

  // super_admins.admin_id points at admins.id; clear it first in case the cascade migration hasn't been run.
  const { error: markerError } = await db.from("super_admins").delete().eq("admin_id", adminId);
  if (markerError) console.error("[staff] remove marker:", markerError.message);

  const { data, error } = await db.from("admins").delete().eq("id", adminId).select("id");
  if (error) {
    console.error("[staff] remove:", error.message);
    return { error: "Couldn’t remove their access. Please try again." };
  }
  if (!data?.length) return { error: MISSING };

  await recordAudit({
    actor: auth.actor,
    action: "staff.remove",
    entity: "staff",
    entityId: adminId,
    summary: `Removed ${roleLabel(target.role)} access from ${target.name}`,
    meta: { role: target.role, email: target.email },
  });

  refresh();
  return {};
}

/** Clears admins rows whose login was deleted in Supabase Auth. */
export async function removeStaleStaff(ids: string[]): Promise<{ error?: string; removed?: number }> {
  const auth = await signedInSuperAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!Array.isArray(ids) || !ids.every((id) => isUuid(id))) return { error: MISSING };

  const db = createAdminClient();
  // The ids come from the browser, so each is checked with Supabase Auth again: only rows with no login go.
  const staff = await loadStaff(db);
  const confirmed = staff.filter((s) => ids.includes(s.id) && !s.hasLogin && s.id !== auth.userId).map((s) => s.id);
  if (!confirmed.length) return { error: "Those records still have working logins, so nothing was removed." };

  const { error: markerError } = await db.from("super_admins").delete().in("admin_id", confirmed);
  if (markerError) console.error("[staff] clean-up marker:", markerError.message);

  const { data, error } = await db.from("admins").delete().in("id", confirmed).select("id");
  if (error) {
    console.error("[staff] clean-up:", error.message);
    return { error: "Couldn’t remove those records. Please try again." };
  }

  const removed = data?.length ?? 0;
  await recordAudit({
    actor: auth.actor,
    action: "staff.remove_stale",
    entity: "staff",
    summary: `Cleared ${removed} staff record${removed === 1 ? "" : "s"} whose login no longer exists`,
    meta: { ids: confirmed },
  });

  refresh();
  return { removed };
}
