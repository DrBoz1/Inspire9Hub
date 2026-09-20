import { createAdminClient } from "@/lib/supabase/admin";
import { toAdminRoom, type AdminRoom, type RawRoom } from "@/lib/admin-rooms";
import { desksOnly, roomsOnly } from "@/lib/spaces";
import { summariseDesks, type DeskSummary, type RawDesk } from "@/lib/admin-desks";

const COLUMNS = "id, name, code, kind, space_group, location, capacity, price_per_hour, price_per_day, regular_price_per_hour, image_url, amenities, show_rating, active, bookable";
/** Without the day pass migration there is no price_per_day column to ask for. */
const COLUMNS_BEFORE_DAY_PASSES = COLUMNS.replace(", price_per_day", "");

/** A workspaces row as this page reads it: a room, or a desk sold by the day. */
type SpaceRow = RawRoom & RawDesk & { kind?: string | null; space_group?: string | null };

export type SpacesData = { rooms: AdminRoom[]; desks: DeskSummary };

/** Read-only. The admin proxy guards the route; saving re-checks the caller itself. */
export async function loadSpaces(): Promise<SpacesData> {
  const db = createAdminClient();
  const first = await db.from("workspaces").select(COLUMNS).order("capacity", { ascending: true });
  const result = first.error?.code === "42703"
    ? await db.from("workspaces").select(COLUMNS_BEFORE_DAY_PASSES).order("capacity", { ascending: true })
    : first;
  // Thrown so the page shows its error screen, not an empty list that looks real.
  if (result.error) throw new Error(`[rooms] load: ${result.error.message}`);

  const rows = (result.data ?? []) as unknown as SpaceRow[];
  return {
    rooms: roomsOnly(rows).map(toAdminRoom),
    desks: summariseDesks(desksOnly(rows)),
  };
}
