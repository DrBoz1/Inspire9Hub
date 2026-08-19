import { createAdminClient } from "@/lib/supabase/admin";
import { getLocalDayBoundsUTC, HUB_TIMEZONE } from "@/lib/datetime";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  // Hub-local day bounds (not raw UTC) — avoids wrong-calendar-day issues
  const { startUTC: todayStart, endUTC: todayEnd } = getLocalDayBoundsUTC(HUB_TIMEZONE);
  const now = new Date().toISOString();

  const [
    pendingRes,
    todayBookingsRes,
    activeMembersRes,
    upcomingRes,
    pendingMembersRes,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("induction_status", "Submitted"),

    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_status", "confirmed")
      .gte("start_date_time", todayStart)
      .lte("start_date_time", todayEnd),

    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("member_status", "Active"),

    supabase
      .from("bookings")
      .select(
        "id, start_date_time, end_date_time, booking_status, workspaces(name), members(full_name)"
      )
      .in("booking_status", ["confirmed", "pending"])
      .gte("start_date_time", now)
      .order("start_date_time", { ascending: true })
      .limit(8),

    supabase
      .from("members")
      .select("id, full_name, company_name")
      .eq("induction_status", "Submitted")
      .limit(5),
  ]);

  const stats = [
    {
      label: "Pending Approvals",
      value: pendingRes.count ?? 0,
      iconName: "ClipboardCheck" as const,
      colorClasses: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
      href: "/admin/approvals",
    },
    {
      label: "Bookings Today",
      value: todayBookingsRes.count ?? 0,
      iconName: "CalendarDays" as const,
      colorClasses: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30",
      href: "/admin/bookings",
    },
    {
      label: "Active Members",
      value: activeMembersRes.count ?? 0,
      iconName: "Users" as const,
      colorClasses: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
      href: "/admin/members",
    },
    {
      label: "Upcoming (Next)",
      value: upcomingRes.data?.length ?? 0,
      iconName: "TrendingUp" as const,
      colorClasses: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30",
      href: "/admin/bookings",
    },
  ];

  return (
    <AdminDashboardClient
      stats={stats}
      upcomingBookings={(upcomingRes.data ?? []) as any}
      pendingMembers={(pendingMembersRes.data ?? []) as any}
    />
  );
}
