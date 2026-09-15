import type { AdminRole } from "@/lib/admin-guard";

// ─── Staff ───────────────────────────────────────────────────────────────────

export type StaffMember = {
  id: string;
  name: string;
  email: string | null;
  role: AdminRole;
  /** False once the matching Supabase Auth login has been deleted. */
  hasLogin: boolean;
};

export type RawStaff = { id: string; full_name?: string | null; email?: string | null; role?: string | null };

export const isAdminRole = (value: unknown): value is AdminRole => value === "admin" || value === "super_admin";

export function toStaffMember(raw: RawStaff, login: { exists: boolean; email?: string | null }): StaffMember {
  return {
    id: raw.id,
    name: raw.full_name?.trim() || "Unnamed",
    // The login's address wins: admins.email goes stale when someone changes it on their account.
    email: login.email?.trim() || raw.email?.trim() || null,
    role: raw.role === "super_admin" ? "super_admin" : "admin",
    hasLogin: login.exists,
  };
}

/** Super admins first, then by name. */
export function sortStaff(list: StaffMember[]) {
  return [...list].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "super_admin" ? -1 : 1));
}

export type StaffFilter = "all" | AdminRole;

export const STAFF_FILTERS: { value: StaffFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "super_admin", label: "Super admins" },
  { value: "admin", label: "Admins" },
];

export function staffCounts(list: StaffMember[]): Record<StaffFilter, number> {
  return {
    all: list.length,
    super_admin: list.filter((s) => s.role === "super_admin").length,
    admin: list.filter((s) => s.role === "admin").length,
  };
}

export function searchStaff(list: StaffMember[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((s) => [s.name, s.email].some((v) => v?.toLowerCase().includes(q)));
}

export const ROLE_INFO: Record<AdminRole, { label: string; summary: string }> = {
  admin: { label: "Admin", summary: "Runs the hub day to day: compliance, bookings, spaces, members and announcements." },
  super_admin: { label: "Super admin", summary: "Everything an admin can do, plus adding and removing staff." },
};

// ─── Guard rails (the server applies the same rules) ─────────────────────────

type Rule = Pick<StaffMember, "id" | "role" | "hasLogin">;

const ONLY_SUPER_ADMIN = "They’re the only super admin. Make someone else a super admin first.";
const superAdminsWhoCanSignIn = (list: Rule[]) => list.filter((s) => s.role === "super_admin" && s.hasLogin).length;

/** Why someone's access can't be removed, or null when it can. */
export function removeBlocker(target: Rule, list: Rule[], currentId: string | null) {
  if (target.id === currentId) return "You can’t remove your own access.";
  if (target.role === "super_admin" && superAdminsWhoCanSignIn(list) <= 1) return ONLY_SUPER_ADMIN;
  return null;
}

/** Why someone's access level can't change to `next`, or null when it can. */
export function roleChangeBlocker(target: Rule, next: AdminRole, list: Rule[], currentId: string | null) {
  if (target.id === currentId) return "Ask another super admin to change your access.";
  if (target.role === next) return `They’re already ${next === "super_admin" ? "a super admin" : "an admin"}.`;
  if (target.role === "super_admin" && superAdminsWhoCanSignIn(list) <= 1) return ONLY_SUPER_ADMIN;
  return null;
}

// ─── People who can be added ─────────────────────────────────────────────────

export type StaffCandidate = { id: string; name: string; email: string | null; company: string | null };
export type RawCandidate = { id: string; full_name?: string | null; email?: string | null; company_name?: string | null };

export function toCandidate(raw: RawCandidate): StaffCandidate {
  return { id: raw.id, name: raw.full_name?.trim() || "New member", email: raw.email?.trim() || null, company: raw.company_name?.trim() || null };
}

export function searchCandidates(list: StaffCandidate[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => [c.name, c.email, c.company].some((v) => v?.toLowerCase().includes(q)));
}
