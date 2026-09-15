import { createAdminClient } from "@/lib/supabase/admin";
import { INDUCTION_STATUS } from "@/lib/constants";
import { hubDateKey } from "@/lib/admin-dashboard";
import {
  outcomeFilter,
  pageWindow,
  sortReviews,
  toHistoryRow,
  toReviewItem,
  totalPages,
  type ComplianceData,
  type RawHistory,
  type RawReview,
} from "@/lib/admin-compliance";

/** Read-only. The admin proxy guards the route; approvals and rejections re-check the caller themselves. */
export async function loadCompliance(params: { view?: string; page?: string; outcome?: string }): Promise<ComplianceData> {
  const supabase = createAdminClient();
  const view = params.view === "history" ? "history" : "pending";
  const outcome = outcomeFilter(params.outcome);
  const { page, from, to } = pageWindow(params.page);

  let history = supabase
    .from("community_entries")
    .select("id, tags, entry_date, entry_description, members(full_name, email, company_name)", { count: "exact" })
    .eq("entry_type", "Induction");
  if (outcome) history = history.eq("tags", outcome);

  const [pending, decisions] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, email, company_name, mobile_number, induction_records!inner(health_emergency_info, completion_date, acknowledged_terms)")
      .eq("induction_status", INDUCTION_STATUS.SUBMITTED),
    history.order("entry_date", { ascending: false }).range(from, to),
  ]);

  // Thrown so the page shows its error screen, not an empty queue that looks real.
  if (pending.error) throw new Error(`[compliance] pending: ${pending.error.message}`);
  // Asking for a page past the end is an error in PostgREST; treat it as an empty page.
  if (decisions.error && decisions.error.code !== "PGRST103") throw new Error(`[compliance] history: ${decisions.error.message}`);

  const historyCount = decisions.count ?? 0;
  return {
    view,
    todayKey: hubDateKey(new Date()),
    pending: sortReviews(((pending.data ?? []) as unknown as RawReview[]).map(toReviewItem)),
    history: ((decisions.data ?? []) as unknown as RawHistory[]).map(toHistoryRow),
    historyCount,
    page,
    totalPages: totalPages(historyCount),
    outcome,
  };
}
