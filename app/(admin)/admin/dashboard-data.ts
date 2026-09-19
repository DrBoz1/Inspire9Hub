import { createAdminClient } from "@/lib/supabase/admin";
import { getLocalDayBoundsUTC, HUB_TIMEZONE } from "@/lib/datetime";
import { BOOKING_STATUS, INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";
import { sortPending, toDashBooking, toDashPending, type DashboardData, type RawBooking, type RawPending } from "@/lib/admin-dashboard";
import { SUBSCRIPTION_COLUMNS, membershipTotals, toPlanSubscription, type RawSubscription } from "@/lib/admin-plans";

const BOOKING_FIELDS = "id, workspace_id, start_date_time, end_date_time, booking_status, workspaces(name), members(full_name)";

/** Everything the admin dashboard shows. Read-only; callers must already be behind the admin guard. */
export async function loadDashboardData(now = new Date()): Promise<DashboardData> {
  const supabase = createAdminClient();
  const { startUTC, endUTC } = getLocalDayBoundsUTC(HUB_TIMEZONE, now);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const live = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING];

  const [pendingCount, activeMembers, totalMembers, nextWeek, today, upcoming, pending, rooms, subscriptions] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("induction_status", INDUCTION_STATUS.SUBMITTED),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("member_status", MEMBER_STATUS.ACTIVE),
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_status", BOOKING_STATUS.CONFIRMED)
      .gte("start_date_time", now.toISOString())
      .lt("start_date_time", weekAhead),
    // Anything that overlaps today, including a booking still running from last night.
    supabase
      .from("bookings")
      .select(BOOKING_FIELDS)
      .in("booking_status", live)
      .lt("start_date_time", endUTC)
      .gt("end_date_time", startUTC)
      .order("start_date_time", { ascending: true }),
    supabase
      .from("bookings")
      .select(BOOKING_FIELDS)
      .in("booking_status", live)
      .gt("start_date_time", endUTC)
      .order("start_date_time", { ascending: true })
      .limit(5),
    supabase
      .from("members")
      .select("id, full_name, company_name, induction_records(completion_date)")
      .eq("induction_status", INDUCTION_STATUS.SUBMITTED)
      .limit(50),
    supabase.from("workspaces").select("id, name, active, bookable").order("name"),
    supabase.from("subscriptions").select(SUBSCRIPTION_COLUMNS).limit(5000),
  ]);

  // Thrown so the page shows its error screen: zeros from a failed query would look like a quiet day.
  const failed = [pendingCount, activeMembers, totalMembers, nextWeek, today, upcoming, pending, rooms].find((result) => result.error);
  if (failed?.error) throw new Error(`[admin dashboard] query failed: ${failed.error.message}`);

  return {
    now: now.toISOString(),
    pendingCount: pendingCount.count ?? 0,
    activeMembers: activeMembers.count ?? 0,
    totalMembers: totalMembers.count ?? 0,
    nextWeekCount: nextWeek.count ?? 0,
    today: ((today.data ?? []) as unknown as RawBooking[]).map(toDashBooking),
    upcoming: ((upcoming.data ?? []) as unknown as RawBooking[]).map(toDashBooking),
    pending: sortPending(((pending.data ?? []) as unknown as RawPending[]).map(toDashPending)),
    rooms: ((rooms.data ?? []) as { id: string; name: string; active?: boolean | null; bookable?: boolean | null }[])
      .filter((room) => room.active !== false && room.bookable !== false)
      .map((room) => ({ id: room.id, name: room.name })),
    // Billing is optional: before its migration the table isn't there, and the tile just stays away.
    membership: subscriptions.error
      ? null
      : (() => {
          const totals = membershipTotals(((subscriptions.data ?? []) as RawSubscription[]).map(toPlanSubscription), now);
          return { mrrCents: totals.mrrCents, members: totals.members };
        })(),
  };
}
