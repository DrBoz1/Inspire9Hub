import { createAdminClient } from "@/lib/supabase/admin";
import { ANNOUNCEMENT_COLUMNS, toAnnouncement, type Announcement, type RawAnnouncement } from "@/lib/admin-announcements";

/** Read-only. The admin proxy guards the route; every change re-checks the caller itself. */
export async function loadAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await createAdminClient()
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) console.error("[announcements] load:", error.message);
  return ((data ?? []) as RawAnnouncement[]).map(toAnnouncement);
}
