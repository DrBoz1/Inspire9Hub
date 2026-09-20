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
import { LEAD_COLUMNS, toLead, type Lead, type RawLead } from "@/lib/admin-leads";
import { roomsOnly } from "@/lib/spaces";

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
  /** Leads that came in during the range. Null when add_leads.sql hasn't been run yet. */
  leads: Lead[] | null;
  /** Every member a won lead has been linked to, whenever they converted. */
  convertedMemberIds: string[];
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

/**
 * The leads side of the report. Not per room, so it's only read for the whole
 * hub. A missing table is expected until add_leads.sql has run, and just means
 * no funnel; anything else is a real failure.
 */
async function loadLeadsFor(db: SupabaseClient, from: string, to: string): Promise<{ leads: Lead[] | null; convertedMemberIds: string[] }> {
  const rows: RawLead[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await db.from("leads").select(LEAD_COLUMNS).gte("created_at", from).lt("created_at", to).order("created_at").order("id").range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") return { leads: null, convertedMemberIds: [] };
      throw new Error(`[insights] leads: ${error.message}`);
    }
    rows.push(...((data ?? []) as RawLead[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  const { data: won, error } = await db.from("leads").select("member_id").eq("stage", "won").not("member_id", "is", null).limit(MAX_ROWS);
  if (error) throw new Error(`[insights] converted: ${error.message}`);
  return { leads: rows.map(toLead), convertedMemberIds: [...new Set((won ?? []).map((r) => r.member_id as string))] };
}

export async function loadInsights(params: { range?: string; room?: string }, now = new Date()): Promise<InsightsData> {
  const range = resolveRange(params.range, now);
  const db = createAdminClient();

  const { data: roomRows, error: roomError } = await db.from("workspaces").select("id, name, kind, space_group, active, bookable").order("name", { ascending: true });
  // Thrown so the page shows its error screen, not an empty report that looks real.
  if (roomError) throw new Error(`[insights] rooms: ${roomError.message}`);
  // Rooms only: a desk sells one day pass a day, so counting it as a room would
  // drag utilisation down and tell an operator nothing about either.
  const rooms: InsightRoom[] = roomsOnly(roomRows ?? []).map((r) => ({
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
  const leadsSide = room ? { leads: null, convertedMemberIds: [] } : await loadLeadsFor(db, range.startUTC, range.endUTC);

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
    ...leadsSide,
  };
}
