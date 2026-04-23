"use server";

import { createClient } from "@/lib/supabase/server";

export async function checkRoomAvailability(
  workspaceId: string,
  startISO: string,
  endISO: string,
) {
  const supabase = await createClient();

  // Search for any existing booking that overlaps with these times
  const { data: conflicts, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .neq("booking_status", "cancelled")
    // The overlap logic
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO);

  if (error) {
    return { error: "Database error during availability check." };
  }

  return { available: conflicts.length === 0 };
}
