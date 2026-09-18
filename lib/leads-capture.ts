import { createAdminClient } from "@/lib/supabase/admin";
import { MESSAGE_MAX, SOURCES, type LeadSource, type LeadValues } from "@/lib/admin-leads";

/**
 * Saves an enquiry as a lead. Server only: it writes with the service-role
 * client, so callers validate first (validateLead) and decide who may call it.
 *
 * One open lead per email address. A repeat enquiry becomes a note on the lead
 * that already exists, and fills in anything that lead was missing, rather than
 * starting a duplicate the team would have to merge by hand.
 */

export type CaptureResult =
  | { saved: true; leadId: string; repeat: boolean }
  /** Not saved: the caller should still get the enquiry to a person some other way. */
  | { saved: false; reason: string };

type DbError = { code?: string; message: string } | null;

/** The table isn't there: add_leads.sql hasn't been run yet. */
const missingTable = (e: DbError) => Boolean(e && (e.code === "PGRST205" || e.code === "42P01"));

function enquiryNote(values: LeadValues, source: LeadSource) {
  const body = `Enquired through ${SOURCES[source].toLowerCase()}${values.message ? `: ${values.message}` : "."}`;
  return body.length > MESSAGE_MAX ? `${body.slice(0, MESSAGE_MAX - 1)}…` : body;
}

export async function captureLead(values: LeadValues, context: { source: LeadSource; memberId?: string | null }): Promise<CaptureResult> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const note = enquiryNote(values, context.source);

  async function addToExisting(): Promise<CaptureResult | null> {
    const { data: existing, error } = await db
      .from("leads")
      .select("id, phone, company, team_size, heard_via, member_id")
      .eq("email", values.email)
      .not("stage", "in", "(won,lost)")
      .maybeSingle();
    if (error) return { saved: false, reason: missingTable(error) ? "The leads table doesn't exist yet." : error.message };
    if (!existing) return null;

    // Only fill gaps: never overwrite what staff may have corrected by hand.
    const gaps: Record<string, unknown> = { last_activity_at: now, updated_at: now };
    if (!existing.phone && values.phone) gaps.phone = values.phone;
    if (!existing.company && values.company) gaps.company = values.company;
    if (!existing.team_size && values.team_size) gaps.team_size = values.team_size;
    if (!existing.heard_via && values.heard_via) gaps.heard_via = values.heard_via;
    if (!existing.member_id && context.memberId) gaps.member_id = context.memberId;

    const [{ error: noteError }, { error: touchError }] = await Promise.all([
      db.from("lead_notes").insert({ lead_id: existing.id, kind: "enquiry", body: note }),
      db.from("leads").update(gaps).eq("id", existing.id),
    ]);
    if (noteError) return { saved: false, reason: noteError.message };
    if (touchError) console.error("[leads] repeat enquiry touch:", touchError.message);
    return { saved: true, leadId: existing.id, repeat: true };
  }

  const repeat = await addToExisting();
  if (repeat) return repeat;

  const { data: created, error } = await db
    .from("leads")
    .insert({ ...values, source: context.source, member_id: context.memberId ?? null, last_activity_at: now })
    .select("id")
    .single();

  if (error) {
    // Two enquiries from the same address landed at once, and the other one won
    // the unique index: this one becomes a note on it instead.
    if (error.code === "23505") {
      const raced = await addToExisting();
      if (raced) return raced;
    }
    return { saved: false, reason: missingTable(error) ? "The leads table doesn't exist yet." : error.message };
  }

  const { error: noteError } = await db.from("lead_notes").insert({ lead_id: created.id, kind: "enquiry", body: note });
  // The lead itself is saved, which is what matters; the timeline just starts one entry short.
  if (noteError) console.error("[leads] first note:", noteError.message);
  return { saved: true, leadId: created.id, repeat: false };
}
