import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_COLUMNS, toLead, type Lead, type RawLead } from "@/lib/admin-leads";

/** Read-only. The admin proxy guards the page. */

export type StaffOption = { id: string; name: string };
export type LeadsData = {
  leads: Lead[];
  staff: StaffOption[];
  /** add_leads.sql hasn't been run: the page explains, rather than showing an error screen. */
  tableMissing: boolean;
};

const PAGE_SIZE = 1000;
/** A ceiling on paging, far above any real pipeline, so a bug can't loop forever. */
const MAX_ROWS = 20_000;

/** The table isn't there yet. Any other failure is a real one. */
const missingTable = (code?: string) => code === "PGRST205" || code === "42P01";

export async function loadLeads(): Promise<LeadsData> {
  const db = createAdminClient();

  const { data: staffRows, error: staffError } = await db.from("admins").select("id, full_name").order("full_name", { ascending: true });
  if (staffError) throw new Error(`[leads] staff: ${staffError.message}`);
  const staff = (staffRows ?? []).map((s) => ({ id: s.id as string, name: (s.full_name as string | null)?.trim() || "Unnamed" }));

  const rows: RawLead[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from("leads")
      .select(LEAD_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      if (missingTable(error.code)) return { leads: [], staff, tableMissing: true };
      // Thrown so the page shows its error screen, not an empty board that looks real.
      throw new Error(`[leads] load: ${error.message}`);
    }
    rows.push(...((data ?? []) as RawLead[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return { leads: rows.map(toLead), staff, tableMissing: false };
}
