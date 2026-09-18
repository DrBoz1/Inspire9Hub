import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/admin-compliance";
import {
  resolveRange,
  toInsightBookings,
  type InsightBooking,
  type InsightRange,
  type InsightRoom,
  type RawInsightBooking,
} from "@/lib/admin-insights";

/**
 * Read-only. The admin proxy guards the page; the export route checks its caller
 * itself before calling this.
 */

const BASE_COLUMNS =
  "id, workspace_id, member_id, start_date_time, end_date_time, booking_status, members(full_name, company_name), payments(amount, refunded_amount, payment_status)";
/** Added by add_booking_audit_columns.sql. */
const AUDIT_COLUMNS = "created_at, cancelled_at";

/** Supabase hands back at most this many rows per request, whatever you ask for. */
const PAGE_SIZE = 1000;
/** Far beyond what the hub books in 180 days; a ceiling so a paging bug can't loop forever. */
const MAX_ROWS = 20_000;

export type InsightsData = {
  now: string;
  range: InsightRange;
  /** Every space, for the filter row. */
  rooms: InsightRoom[];
  /** The one space being looked at, or null for the whole hub. */
  room: InsightRoom | null;
  /** The spaces this report covers. */
  scope: InsightRoom[];
  sellableRooms: number;
  /** Bookings starting in the range AND the equal period before it, for comparisons. */
  bookings: InsightBooking[];
  /** False until add_booking_audit_columns.sql has been run. */
  auditColumns: boolean;
  /** True only if the safety ceiling cut the list short; the page says so rather than under-counting quietly. */
  truncated: boolean;
};

type Page = { rows: RawInsightBooking[]; truncated: boolean } | { error: { code?: string; message: string } };

/**
 * Pages through the bookings. A single select silently stops at 1,000 rows, so a
 * busy quarter compared with the one before would otherwise under-count revenue
 * with no error at all.
 */
async function fetchBookings(db: SupabaseClient, columns: string, from: string, to: string, roomId: string | null): Promise<Page> {
  const rows: RawInsightBooking[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    let query = db.from("bookings").select(columns).gte("start_date_time", from).lt("start_date_time", to);
    if (roomId) query = query.eq("workspace_id", roomId);
    // Ordered on a unique key as well, so pages can't overlap or skip rows.
    const { data, error } = await query.order("start_date_time", { ascending: true }).order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) return { error };
    const page = (data ?? []) as unknown as RawInsightBooking[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** Postgres "undefined column": the audit migration hasn't been run on this database yet. */
const missingColumn = (error: { code?: string; message: string }) => error.code === "42703" || /column .* does not exist/i.test(error.message);

export async function loadInsights(params: { range?: string; room?: string }, now = new Date()): Promise<InsightsData> {
  const range = resolveRange(params.range, now);
  const db = createAdminClient();

  const { data: roomRows, error: roomError } = await db.from("workspaces").select("id, name, active, bookable").order("name", { ascending: true });
  // Thrown so the page shows its error screen, not an empty report that looks real.
  if (roomError) throw new Error(`[insights] rooms: ${roomError.message}`);
  const rooms: InsightRoom[] = (roomRows ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string | null)?.trim() || "Unnamed space",
    sellable: r.active !== false && r.bookable !== false,
  }));

  // Only a room that exists narrows the report; anything else in the URL is ignored.
  const room = isUuid(params.room) ? (rooms.find((r) => r.id === params.room) ?? null) : null;
  const scope = room ? [room] : rooms;

  const from = range.previous.startUTC;
  const to = range.endUTC;
  let auditColumns = true;
  let page = await fetchBookings(db, `${BASE_COLUMNS}, ${AUDIT_COLUMNS}`, from, to, room?.id ?? null);
  if ("error" in page && missingColumn(page.error)) {
    auditColumns = false;
    page = await fetchBookings(db, BASE_COLUMNS, from, to, room?.id ?? null);
  }
  if ("error" in page) throw new Error(`[insights] bookings: ${page.error.message}`);

  return {
    now: now.toISOString(),
    range,
    rooms,
    room,
    scope,
    sellableRooms: scope.filter((r) => r.sellable).length,
    bookings: toInsightBookings(page.rows),
    auditColumns,
    truncated: page.truncated,
  };
}
