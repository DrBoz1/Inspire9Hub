export type AdminIcon = "dashboard" | "compliance" | "bookings" | "spaces" | "members" | "announcements" | "staff";
export type AdminNavItem = { href: string; label: string; icon: AdminIcon; badge?: "approvals" };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

const GROUPS: AdminNavGroup[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }] },
  {
    label: "Operations",
    items: [
      { href: "/admin/approvals", label: "Compliance", icon: "compliance", badge: "approvals" },
      { href: "/admin/bookings", label: "Booking schedule", icon: "bookings" },
      { href: "/admin/rooms", label: "Space management", icon: "spaces" },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/members", label: "Members", icon: "members" },
      { href: "/admin/announcements", label: "Announcements", icon: "announcements" },
    ],
  },
];

const TEAM: AdminNavGroup = {
  label: "Team",
  items: [{ href: "/admin/management", label: "Staff management", icon: "staff" }],
};

/** Staff management is for super admins only; the proxy enforces it, the nav just doesn't offer it. */
export function adminNav(isSuperAdmin: boolean): AdminNavGroup[] {
  return isSuperAdmin ? [...GROUPS, TEAM] : GROUPS;
}

export function isActiveAdminPath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The page name shown in the header. Approval history now lives inside Compliance. */
export function adminPageLabel(pathname: string) {
  if (pathname === "/admin/history" || pathname.startsWith("/admin/history/")) return "Compliance";
  const item = [...GROUPS, TEAM].flatMap((g) => g.items).find((i) => isActiveAdminPath(pathname, i.href));
  return item?.label ?? "Admin";
}

export function adminRoleLabel(role: string | null | undefined) {
  return role === "super_admin" ? "Super admin" : "Admin";
}
