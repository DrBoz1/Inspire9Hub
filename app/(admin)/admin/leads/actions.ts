"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { isUuid } from "@/lib/admin-compliance";
import { recordAudit } from "@/lib/audit";
import { HUB_TIMEZONE } from "@/lib/datetime";
import { todayIn } from "@/features/booking-map/zoned-time";
import {
  LEAD_COLUMNS,
  SOURCES,
  STAGE_LABELS,
  dayLabel,
  isStage,
  stageNote,
  stagePatch,
  toLead,
  toLeadNote,
  validateLead,
  validateNote,
  type Lead,
  type LeadErrors,
  type LeadField,
  type LeadNote,
  type LeadStage,
  type RawLead,
  type RawLeadNote,
} from "@/lib/admin-leads";

// Every action checks its caller, and problems come back as values: Next hides thrown messages in production.
const MISSING = "That lead couldn’t be found. It may have been deleted.";
const NOT_SET_UP = "The leads table isn’t set up yet. Run add_leads.sql in Supabase.";
const MOVED = "Someone else changed this lead just now. Close it and open it again to see the latest.";
const NOTE_COLUMNS = "id, kind, body, author_name, created_at";

type DbError = { code?: string; message: string } | null;
const friendly = (error: DbError, fallback: string) => (error?.code === "PGRST205" || error?.code === "42P01" ? NOT_SET_UP : fallback);

/** The signed-in admin, with the name notes are signed with. */
async function signedInStaff() {
  const guard = await requireAdmin();
  if ("error" in guard) return { ok: false, error: guard.error ?? "Only admins can do that." } as const;
  const { data } = await createAdminClient().from("admins").select("full_name").eq("id", guard.user.id).maybeSingle();
  return {
    ok: true,
    actor: { id: guard.user.id, email: guard.user.email },
    name: (data?.full_name as string | null)?.trim() || guard.user.email || "Staff",
  } as const;
}

function refresh() {
  revalidatePath("/admin/leads");
  // The sidebar counts new leads on every admin page.
  revalidatePath("/admin", "layout");
}

async function readLead(id: string): Promise<{ lead: Lead } | { error: string }> {
  const { data, error } = await createAdminClient().from("leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle();
  if (error) return { error: friendly(error, "Couldn’t load that lead. Please try again.") };
  return data ? { lead: toLead(data as RawLead) } : { error: MISSING };
}

async function writeNote(leadId: string, kind: LeadNote["kind"], body: string, author: { id: string; name: string } | null) {
  const { data, error } = await createAdminClient()
    .from("lead_notes")
    .insert({ lead_id: leadId, kind, body, author_id: author?.id ?? null, author_name: author?.name ?? null })
    .select(NOTE_COLUMNS)
    .single();
  if (error) console.error("[leads] note:", error.message);
  return data ? toLeadNote(data as RawLeadNote) : null;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export async function getLeadTimeline(leadId: string): Promise<{ error: string } | { notes: LeadNote[] }> {
  const who = await signedInStaff();
  if (!who.ok) return { error: who.error };
  if (!isUuid(leadId)) return { error: MISSING };
  const { data, error } = await createAdminClient().from("lead_notes").select(NOTE_COLUMNS).eq("lead_id", leadId).order("created_at", { ascending: false }).limit(200);
  if (error) return { error: friendly(error, "Couldn’t load the history. Please try again.") };
  return { notes: (data ?? []).map((n) => toLeadNote(n as RawLeadNote)) };
}

// ─── Adding ──────────────────────────────────────────────────────────────────

export type AddLeadResult = { error?: string; fieldErrors?: LeadErrors; saved?: Lead };

/** A lead staff log by hand: a walk-in, a phone call, a referral. */
export async function addLead(formData: FormData): Promise<AddLeadResult> {
  const who = await signedInStaff();
  if (!who.ok) return { error: who.error };

  const fields: LeadField[] = ["name", "email", "phone", "company", "interest", "teamSize", "message", "heardVia", "source", "nextFollowUp"];
  const checked = validateLead(Object.fromEntries(fields.map((f) => [f, formData.get(f)])), { staff: true, today: todayIn(HUB_TIMEZONE) });
  if ("errors" in checked) return { error: "Check the highlighted fields.", fieldErrors: checked.errors };
  const values = checked.values;

  const db = createAdminClient();
  const already = `There’s already an open lead for ${values.email}. Search for it and add to that one instead.`;
  const { data: existing, error: lookupError } = await db.from("leads").select("id").eq("email", values.email).not("stage", "in", "(won,lost)").maybeSingle();
  if (lookupError) return { error: friendly(lookupError, "Couldn’t add the lead. Please try again.") };
  if (existing) return { error: already };

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("leads")
    .insert({ ...values, owner_id: who.actor.id, last_activity_at: now })
    .select(LEAD_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") return { error: already };
    console.error("[leads] add:", error.message);
    return { error: friendly(error, "Couldn’t add the lead. Please try again.") };
  }

  const lead = toLead(data as RawLead);
  await writeNote(lead.id, "enquiry", `Added by ${who.name}: came in through ${SOURCES[values.source].toLowerCase()}${values.message ? `. ${values.message}` : "."}`.slice(0, 2000), { id: who.actor.id, name: who.name });
  await recordAudit({ actor: who.actor, action: "lead.create", entity: "lead", entityId: lead.id, summary: `Added ${lead.name} as a lead (${SOURCES[values.source].toLowerCase()})`, meta: { source: values.source } });
  refresh();
  return { saved: lead };
}

// ─── Working a lead ──────────────────────────────────────────────────────────

export type LeadUpdate = { error: string } | { saved: Lead; note: LeadNote | null };

export async function moveLeadStage(leadId: string, to: LeadStage, lostReason?: string): Promise<LeadUpdate> {
  const who = await signedInStaff();
  if (!who.ok) return { error: who.error };
  if (!isUuid(leadId)) return { error: MISSING };
  if (!isStage(to)) return { error: "Pick a stage." };

  const read = await readLead(leadId);
  if ("error" in read) return read;
  const { lead } = read;
  const change = stagePatch(lead, to, new Date(), lostReason);
  if ("error" in change) return change;

  // Only if it's still where this admin saw it: two people moving the same lead
  // at once shouldn't silently undo each other.
  const { data, error } = await createAdminClient().from("leads").update(change.patch).eq("id", leadId).eq("stage", lead.stage).select(LEAD_COLUMNS).maybeSingle();
  if (error) {
    // Reopening a closed lead while a newer open one exists for the same email.
    if (error.code === "23505") return { error: "This person already has another open lead. Work on that one instead of reopening this." };
    console.error("[leads] stage:", error.message);
    return { error: friendly(error, "Couldn’t move the lead. Please try again.") };
  }
  if (!data) return { error: MOVED };

  const saved = toLead(data as RawLead);
  const note = await writeNote(leadId, "stage", stageNote(lead.stage, to, saved.lostReason), { id: who.actor.id, name: who.name });
  await recordAudit({ actor: who.actor, action: "lead.stage", entity: "lead", entityId: leadId, summary: `${stageNote(lead.stage, to, saved.lostReason)} for ${lead.name}`, meta: { from: lead.stage, to, lostReason: saved.lostReason } });
  refresh();
  return { saved, note };
}

export async function addLeadNote(leadId: string, kind: string, body: string): Promise<LeadUpdate> {
  const who = await signedInStaff();
  if (!who.ok) return { error: who.error };
  if (!isUuid(leadId)) return { error: MISSING };
  const checked = validateNote(kind, body);
  if ("error" in checked) return checked;

  const db = createAdminClient();
  const { data: noteRow, error: noteError } = await db
    .from("lead_notes")
    .insert({ lead_id: leadId, kind: checked.kind, body: checked.body, author_id: who.actor.id, author_name: who.name })
    .select(NOTE_COLUMNS)
    .single();
  if (noteError) {
    if (noteError.code === "23503") return { error: MISSING };
    return { error: friendly(noteError, "Couldn’t save that. Please try again.") };
  }

  const now = new Date().toISOString();
  const { data, error } = await db.from("leads").update({ last_activity_at: now, updated_at: now }).eq("id", leadId).select(LEAD_COLUMNS).maybeSingle();
  if (error || !data) return { error: error ? friendly(error, "Saved, but the lead didn’t update. Refresh the page.") : MISSING };
  refresh();
  return { saved: toLead(data as RawLead), note: toLeadNote(noteRow as RawLeadNote) };
}

/** Who's looking after it, and when to get back to them. */
export async function updateLeadDetails(leadId: string, details: { ownerId: string | null; nextFollowUp: string | null }): Promise<LeadUpdate> {
  const who = await signedInStaff();
  if (!who.ok) return { error: who.error };
  if (!isUuid(leadId)) return { error: MISSING };

  const db = createAdminClient();
  if (details.ownerId !== null) {
    if (!isUuid(details.ownerId)) return { error: "Pick someone from the list." };
    const { data: owner } = await db.from("admins").select("id").eq("id", details.ownerId).maybeSingle();
    if (!owner) return { error: "That person isn’t on the staff list any more." };
  }
  const read = await readLead(leadId);
  if ("error" in read) return read;

  const follow = details.nextFollowUp;
  if (follow !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(follow) || Number.isNaN(Date.parse(`${follow}T00:00:00Z`))) return { error: "That isn’t a real date." };
    // Only a new date has to be in the future. An overdue one left as it was
    // mustn't stop someone saving a change of owner.
    if (follow !== read.lead.nextFollowUp && follow < todayIn(HUB_TIMEZONE)) return { error: "Pick today or a later date, or clear it." };
  }
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("leads")
    .update({ owner_id: details.ownerId, next_follow_up: follow, last_activity_at: now, updated_at: now })
    .eq("id", leadId)
    .select(LEAD_COLUMNS)
    .maybeSingle();
  if (error) return { error: friendly(error, "Couldn’t save that. Please try again.") };
  if (!data) return { error: MISSING };

  const saved = toLead(data as RawLead);
  const changes = [
    read.lead.ownerId !== saved.ownerId ? (saved.ownerId ? "changed who’s looking after it" : "cleared who’s looking after it") : null,
    read.lead.nextFollowUp !== saved.nextFollowUp ? (saved.nextFollowUp ? `set a follow-up for ${dayLabel(saved.nextFollowUp)}` : "cleared the follow-up") : null,
  ].filter(Boolean);
  if (changes.length) {
    await recordAudit({ actor: who.actor, action: "lead.update", entity: "lead", entityId: leadId, summary: `${who.name} ${changes.join(" and ")} on ${saved.name}`, meta: details });
  }
  refresh();
  return { saved, note: null };
}

/** Escapes LIKE's wildcards, so an address with an underscore can only match itself. */
const exactly = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Marks the lead won and links it to their member account if one exists with
 * the same email. It never creates an account: signing up has its own email
 * confirmation and induction, and skipping those would skip the safety checks.
 */
export async function convertLead(leadId: string): Promise<LeadUpdate & { linked?: string | null }> {
  const who = await signedInStaff();
  if (!who.ok) return { error: who.error };
  if (!isUuid(leadId)) return { error: MISSING };

  const read = await readLead(leadId);
  if ("error" in read) return read;
  const { lead } = read;

  const db = createAdminClient();
  const { data: matches, error: matchError } = await db.from("members").select("id, full_name").ilike("email", exactly(lead.email)).limit(2);
  if (matchError) return { error: "Couldn’t look for their member account. Please try again." };
  if ((matches ?? []).length > 1) return { error: `More than one member account uses ${lead.email}. Link it by hand from Members.` };
  const member = matches?.[0] ?? null;

  if (lead.stage === "won" && (lead.memberId || !member)) {
    return { error: lead.memberId ? "This lead is already linked to a member." : `No member account uses ${lead.email} yet. Try again once they’ve signed up.` };
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() };
  if (lead.stage !== "won") {
    const change = stagePatch(lead, "won", new Date());
    if ("error" in change) return change;
    Object.assign(patch, change.patch);
  }
  if (member) patch.member_id = member.id;

  const { data, error } = await db.from("leads").update(patch).eq("id", leadId).eq("stage", lead.stage).select(LEAD_COLUMNS).maybeSingle();
  if (error) return { error: friendly(error, "Couldn’t update the lead. Please try again.") };
  if (!data) return { error: MOVED };

  const saved = toLead(data as RawLead);
  const memberName = (member?.full_name as string | null)?.trim() || "their";
  const body = member
    ? `${lead.stage === "won" ? "Linked" : `Moved from ${STAGE_LABELS[lead.stage]} to Won, and linked`} to ${memberName === "their" ? "their" : `${memberName}’s`} member account.`
    : `Moved from ${STAGE_LABELS[lead.stage]} to Won. No member account uses ${lead.email} yet; link it once they’ve signed up.`;
  const note = await writeNote(leadId, "stage", body, { id: who.actor.id, name: who.name });
  await recordAudit({ actor: who.actor, action: "lead.convert", entity: "lead", entityId: leadId, summary: `${saved.name}: ${body}`, meta: { memberId: member?.id ?? null } });
  refresh();
  return { saved, note, linked: member ? memberName : null };
}
