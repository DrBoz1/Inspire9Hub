"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { isUuid } from "@/lib/admin-compliance";
import { hubDateKey } from "@/lib/admin-dashboard";
import {
  ANNOUNCEMENT_COLUMNS,
  toAnnouncement,
  validateAnnouncement,
  type Announcement,
  type AnnouncementErrors,
  type RawAnnouncement,
} from "@/lib/admin-announcements";

export type AnnouncementResult = { error?: string; saved?: Announcement };
export type AnnouncementSaveResult = AnnouncementResult & { fieldErrors?: AnnouncementErrors };

// Every action checks its caller, and problems come back as values: Next hides thrown messages in production.
const MISSING = "That announcement couldn’t be found. It may have been deleted.";
const NOT_ADMIN = "Only admins can do that.";

function refresh() {
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
}

/** Posts a new announcement, or edits one when the form carries an id. */
export async function saveAnnouncement(formData: FormData): Promise<AnnouncementSaveResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error ?? NOT_ADMIN };

  const id = formData.get("id");
  if (id !== null && !isUuid(id)) return { error: MISSING };

  const checked = validateAnnouncement(
    { type: formData.get("type"), title: formData.get("title"), message: formData.get("message"), endsOn: formData.get("endsOn") },
    hubDateKey(new Date()),
  );
  if ("errors" in checked) return { error: "Check the highlighted fields.", fieldErrors: checked.errors };

  const db = createAdminClient();
  const { data, error } = id
    ? await db.from("announcements").update(checked.values).eq("id", id).select(ANNOUNCEMENT_COLUMNS).maybeSingle()
    : await db.from("announcements").insert({ ...checked.values, status: "active", created_by: auth.user.id }).select(ANNOUNCEMENT_COLUMNS).single();

  if (error) {
    console.error("[announcements] save:", error.message);
    return { error: "Couldn’t save the announcement. Please try again." };
  }
  if (!data) return { error: MISSING };
  refresh();
  return { saved: toAnnouncement(data as RawAnnouncement) };
}

async function setStatus(id: string, status: Announcement["status"], verb: string): Promise<AnnouncementResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error ?? NOT_ADMIN };
  if (!isUuid(id)) return { error: MISSING };

  const db = createAdminClient();
  const { data: current, error: readError } = await db.from("announcements").select("expires_at").eq("id", id).maybeSingle();
  if (readError) {
    console.error(`[announcements] ${verb}:`, readError.message);
    return { error: `Couldn’t ${verb} it. Please try again.` };
  }
  if (!current) return { error: MISSING };

  // Restoring one whose end date has passed would leave it hidden, so it comes back with no end date.
  const expired = Boolean(current.expires_at) && Date.parse(current.expires_at) <= Date.now();
  const update = status === "active" && expired ? { status, expires_at: null } : { status };

  const { data, error } = await db.from("announcements").update(update).eq("id", id).select(ANNOUNCEMENT_COLUMNS).maybeSingle();
  if (error) {
    console.error(`[announcements] ${verb}:`, error.message);
    return { error: `Couldn’t ${verb} it. Please try again.` };
  }
  if (!data) return { error: MISSING };
  refresh();
  return { saved: toAnnouncement(data as RawAnnouncement) };
}

export async function archiveAnnouncement(id: string): Promise<AnnouncementResult> {
  return setStatus(id, "archived", "archive");
}

export async function restoreAnnouncement(id: string): Promise<AnnouncementResult> {
  return setStatus(id, "active", "restore");
}

export async function deleteAnnouncement(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error ?? NOT_ADMIN };
  if (!isUuid(id)) return { error: MISSING };

  const { data, error } = await createAdminClient().from("announcements").delete().eq("id", id).select("id");
  if (error) {
    console.error("[announcements] delete:", error.message);
    return { error: "Couldn’t delete it. Please try again." };
  }
  if (!data?.length) return { error: MISSING };
  refresh();
  return {};
}
