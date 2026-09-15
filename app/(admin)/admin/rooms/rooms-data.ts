import { createAdminClient } from "@/lib/supabase/admin";
import { toAdminRoom, type AdminRoom, type RawRoom } from "@/lib/admin-rooms";

/** Read-only. The admin proxy guards the route; saving re-checks the caller itself. */
export async function loadRooms(): Promise<AdminRoom[]> {
  const { data, error } = await createAdminClient()
    .from("workspaces")
    .select("id, name, location, capacity, price_per_hour, regular_price_per_hour, image_url, amenities, show_rating, active, bookable")
    .order("capacity", { ascending: true });
  // Thrown so the page shows its error screen, not an empty list that looks real.
  if (error) throw new Error(`[rooms] load: ${error.message}`);
  return ((data ?? []) as RawRoom[]).map(toAdminRoom);
}
