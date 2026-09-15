import { createAdminClient } from "@/lib/supabase/admin";
import { getLocalDayBoundsUTC, HUB_TIMEZONE } from "@/lib/datetime";
import { pageWindow, totalPages } from "@/lib/admin-compliance";
import {
  SCHEDULE_FILTERS,
  SCHEDULE_PAGE_SIZE,
  filterConditions,
  sanitizeSearch,
  scheduleFilter,
  toScheduleRow,
  type FilterCondition,
  type RawScheduleBooking,
  type ScheduleData,
  type ScheduleFilter,
} from "@/lib/admin-bookings";

type Bounds = { now: string; dayStart: string; dayEnd: string };
type Chain = Record<FilterCondition["op"], (column: string, value: string) => Chain>;

/** Applies a filter to any bookings query. Loosely typed on purpose: Supabase's builder types recurse too deeply for a generic helper. */
function scoped<T>(query: T, filter: ScheduleFilter, bounds: Bounds): T {
  let chain = query as unknown as Chain;
  for (const c of filterConditions(filter, bounds)) chain = chain[c.op](c.column, c.value);
  return chain as unknown as T;
}

/** Read-only. The admin proxy guards the route; cancel and refund re-check the caller themselves. */
export async function loadSchedule(params: { filter?: string; page?: string; q?: string }, now = new Date()): Promise<ScheduleData> {
  const supabase = createAdminClient();
  const filter = scheduleFilter(params.filter);
  const q = sanitizeSearch(params.q);
  const { page, from, to } = pageWindow(params.page, SCHEDULE_PAGE_SIZE);
  const { startUTC, endUTC } = getLocalDayBoundsUTC(HUB_TIMEZONE, now);
  const bounds = { now: now.toISOString(), dayStart: startUTC, dayEnd: endUTC };

  const members = q ? "members!inner(full_name, email)" : "members(full_name, email)";
  let query = scoped(
    supabase
      .from("bookings")
      .select(`id, start_date_time, end_date_time, booking_status, workspaces(name, location), ${members}, payments(amount, payment_status, refunded_amount, stripe_payment_intent_id)`, { count: "exact" }),
    filter,
    bounds,
  );
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`, { referencedTable: "members" });

  const countOf = (f: ScheduleFilter) => scoped(supabase.from("bookings").select("id", { count: "exact", head: true }), f, bounds);
  const [result, ...counts] = await Promise.all([
    query.order("start_date_time", { ascending: filter === "upcoming" || filter === "today" }).range(from, to),
    ...(q ? [] : SCHEDULE_FILTERS.map((f) => countOf(f.value))),
  ]);

  // Asking for a page past the end is an error in PostgREST; treat it as an empty page.
  // Anything else is thrown so the page shows its error screen, not an empty schedule that looks real.
  if (result.error && result.error.code !== "PGRST103") throw new Error(`[schedule] bookings: ${result.error.message}`);
  const total = result.count ?? 0;

  return {
    now: bounds.now,
    filter,
    q,
    page,
    total,
    totalPages: totalPages(total, SCHEDULE_PAGE_SIZE),
    counts: q ? null : (Object.fromEntries(SCHEDULE_FILTERS.map((f, i) => [f.value, counts[i]?.count ?? 0])) as Record<ScheduleFilter, number>),
    rows: ((result.data ?? []) as unknown as RawScheduleBooking[]).map(toScheduleRow),
  };
}
