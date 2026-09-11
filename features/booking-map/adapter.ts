/**
 * The seam between the database and the floor plan.
 *
 * Everything that crosses from `workspaces` / `bookings` into the map's own types
 * goes through here, and nothing else in the map touches a database shape. Pure
 * functions only: no fetching, no clock, no DOM -- so every rule below is pinned by
 * adapter.test.ts rather than discovered in production.
 *
 * What comes from where:
 *   - The drawing owns geometry: `shape`, `label`, `labelAt`, and `zone` (which wing
 *     a space is in is a fact about where it's drawn).
 *   - The database owns everything an admin edits: name, price, capacity, amenities,
 *     description, booking limits, whether it's bookable at all.
 *   - `floorplan_id` on a workspaces row is the join. A drawn space with no row
 *     pointing at it is shown but can't be booked.
 *
 * Tolerates the phase-2 migration not having been run: rows without the new columns
 * simply link to nothing.
 */

import type { Booking, Space, SpaceGroup, SpaceKind } from './booking/types';
import { makeISO } from './booking/time';
import { toAmenityKeys } from '@/lib/amenities';
import { wallClockAt, wallClockToUtc, isDateKey } from './zoned-time';

// ── inputs ────────────────────────────────────────────────────────────────────

/** A `workspaces` row. The floor-plan columns are optional: before the migration
 *  runs they don't exist at all. */
export interface WorkspaceRow {
  id: string;
  name: string;
  capacity: number | null;
  location?: string | null;
  price_per_hour: number | string | null;
  amenities: string[] | null;
  floorplan_id?: string | null;
  code?: string | null;
  kind?: string | null;
  space_group?: string | null;
  bookable?: boolean | null;
  description?: string | null;
  min_minutes?: number | null;
  max_minutes?: number | null;
  active?: boolean | null;
}

/** One booking as the server sends it to the map. Deliberately minimal: no member
 *  ids and no names -- only whether it's the viewer's own. */
export interface DayBookingRow {
  id: string;
  workspaceId: string;
  startUtc: string;
  endUtc: string;
  mine: boolean;
  pending: boolean;
}

// ── vocabularies ─────────────────────────────────────────────────────────────

// Total Records, so a SpaceKind or SpaceGroup added to types.ts without being
// listed here is a compile error, not a value silently rejected at runtime.
const KINDS: Record<SpaceKind, true> = {
  desk: true, workpoint: true, collab_table: true, lounge_pod: true, team_bay: true,
  phone_booth: true, meeting_room: true, boardroom: true, training_room: true,
  private_office: true, amenity: true,
};
const GROUPS: Record<SpaceGroup, true> = { desks: true, rooms: true, offices: true, facilities: true };

const isKind = (v: unknown): v is SpaceKind => typeof v === 'string' && v in KINDS;
const isGroup = (v: unknown): v is SpaceGroup => typeof v === 'string' && v in GROUPS;

function positiveInt(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined;
}

function price(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
}

// ── spaces ────────────────────────────────────────────────────────────────────

export interface MergedSpaces {
  spaces: Space[];
  /** How many drawn spaces are backed by a bookable room. */
  linkedCount: number;
  /** Data problems worth showing an admin. Never thrown: one bad row mustn't blank
   *  the whole map. */
  problems: string[];
}

export function mergeSpaces(plan: readonly Space[], rows: readonly WorkspaceRow[]): MergedSpaces {
  const problems: string[] = [];
  const planIds = new Set(plan.map((s) => s.id));
  const byPlanId = new Map<string, WorkspaceRow>();

  for (const row of rows) {
    const fid = row.floorplan_id;
    if (!fid) continue;
    if (row.active === false) continue;
    if (!planIds.has(fid)) {
      problems.push(`"${row.name}" is linked to plan position "${fid}", which isn't on the floor plan.`);
      continue;
    }
    const existing = byPlanId.get(fid);
    if (existing) {
      // The database's partial unique index forbids this; if it ever happens anyway,
      // keep the first and say so rather than pick silently.
      problems.push(`"${row.name}" and "${existing.name}" are both linked to "${fid}"; showing "${existing.name}".`);
      continue;
    }
    byPlanId.set(fid, row);
  }

  let linkedCount = 0;
  const spaces = plan.map((s): Space => {
    // Kitchens, stairwells, washrooms: part of the drawing, never bookable.
    if (!s.bookable) return s;

    const row = byPlanId.get(s.id);
    // Unlinked: price and limits come only from a real room.
    if (!row) {
      return { ...s, bookable: false, unlinked: true, ratePerHour: undefined, minMinutes: undefined, maxMinutes: undefined };
    }

    const rate = price(row.price_per_hour);
    if (rate === undefined) {
      problems.push(`"${row.name}" has no valid hourly price, so it can't be booked.`);
    }
    const min = positiveInt(row.min_minutes) ?? s.minMinutes;
    let max = positiveInt(row.max_minutes) ?? s.maxMinutes;
    if (min !== undefined && max !== undefined && max < min) {
      problems.push(`"${row.name}" has a maximum booking shorter than its minimum; ignoring the maximum.`);
      max = undefined;
    }

    const bookable = row.bookable !== false && rate !== undefined;
    if (bookable) linkedCount++;

    return {
      ...s,
      name: row.name?.trim() || s.name,
      code: row.code?.trim() || s.code,
      kind: isKind(row.kind) ? row.kind : s.kind,
      group: isGroup(row.space_group) ? row.space_group : s.group,
      capacity: positiveInt(row.capacity) ?? s.capacity,
      amenities: toAmenityKeys(row.amenities ?? []),
      description: row.description?.trim() || s.description,
      minMinutes: min,
      maxMinutes: max,
      ratePerHour: rate,
      bookable,
      workspaceId: row.id,
      unlinked: false,
      // shape, label, labelAt and zone come from the drawing, untouched.
    };
  });

  return { spaces, linkedCount, problems };
}

/** workspace id -> plan space id, for the spaces that are linked. */
export function planIdByWorkspace(spaces: readonly Space[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of spaces) if (s.workspaceId) m.set(s.workspaceId, s.id);
  return m;
}

// ── bookings ──────────────────────────────────────────────────────────────────

export interface MappedBookings {
  bookings: Booking[];
  skipped: number;
}

/**
 * The server's rows for one hub-local day, as map bookings in that day's wall-clock
 * time. Clipped to the day, so a booking that crosses midnight contributes only the
 * part that falls on it.
 */
export function toMapBookings(
  rows: readonly DayBookingRow[],
  day: string,
  tz: string,
  spaceIdByWorkspace: ReadonlyMap<string, string>,
): MappedBookings {
  if (!isDateKey(day)) throw new RangeError(`Not a date key: ${JSON.stringify(day)}`);
  const out: Booking[] = [];
  let skipped = 0;

  for (const r of rows) {
    // Your own pending hold is ignored, exactly as checkRoomAvailability ignores it:
    // an abandoned Stripe checkout mustn't lock you out of the slot you were buying.
    // Anyone else's pending hold blocks, because their checkout is in progress.
    if (r.mine && r.pending) continue;

    const spaceId = spaceIdByWorkspace.get(r.workspaceId);
    if (!spaceId) continue; // a room that exists but isn't drawn on the plan

    const s = Date.parse(r.startUtc);
    const e = Date.parse(r.endUtc);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      skipped++;
      continue;
    }

    const ws = wallClockAt(s, tz);
    const we = wallClockAt(e, tz);
    if (ws.date > day || we.date < day) continue; // not on this day at all
    const from = ws.date < day ? 0 : ws.mins;
    const to = we.date > day ? 1440 : we.mins;
    if (to <= from) continue;

    out.push({
      id: r.id,
      spaceId,
      start: makeISO(day, from),
      end: makeISO(day, to),
      // No one else's name leaves the server; the map only learns "booked".
      title: r.mine ? 'Your booking' : 'Booked',
      owner: r.mine ? 'you' : 'another member',
      mine: r.mine,
    });
  }

  return { bookings: out, skipped };
}

// ── the way back ─────────────────────────────────────────────────────────────

/** A window on the map as the UTC instants the booking server action expects. */
export function windowToUtcRange(
  day: string,
  from: number,
  to: number,
  tz: string,
): { startISO: string; endISO: string } {
  if (!(to > from)) throw new RangeError(`End (${to}) must be after start (${from}).`);
  return {
    startISO: new Date(wallClockToUtc(day, from, tz)).toISOString(),
    endISO: new Date(wallClockToUtc(day, to, tz)).toISOString(),
  };
}
