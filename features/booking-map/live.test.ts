import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeSpaces, planIdByWorkspace, toMapBookings, windowToUtcRange, type WorkspaceRow } from './adapter';
import { SPACES } from './data/spaces';
import { wallClockAt } from './zoned-time';
import { HUB_TIMEZONE } from '@/lib/datetime';

/**
 * Real data through the adapter. READ-ONLY: every request here is a GET.
 *
 * Skipped unless LIVE_DB=1, because it needs .env.local and a reachable database --
 * neither of which CI has or should have. Run locally with:
 *   LIVE_DB=1 npx vitest run features/booking-map/live.test.ts
 */
const LIVE = process.env.LIVE_DB === '1';

function env(): Record<string, string> {
  const raw = readFileSync(join(import.meta.dirname, '../../.env.local'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function get<T>(path: string): Promise<T> {
  const e = env();
  const key = e.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    method: 'GET',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json() as Promise<T>;
}

type BookingRow = {
  id: string; workspace_id: string; member_id: string;
  start_date_time: string; end_date_time: string; booking_status: string;
};

describe.skipIf(!LIVE)('live database (read-only)', () => {
  it('merges the real rooms without errors, before or after the migration', async () => {
    const rows = await get<WorkspaceRow[]>('workspaces?select=*');
    expect(rows.length).toBeGreaterThan(0);
    const { spaces, problems } = mergeSpaces(SPACES, rows);
    expect(spaces).toHaveLength(SPACES.length);
    expect(problems).toEqual([]);
  });

  it('round-trips every real booking’s times through the Melbourne wall clock', async () => {
    const rooms = await get<WorkspaceRow[]>('workspaces?select=id,name,capacity,price_per_hour,amenities');
    const bookings = await get<BookingRow[]>(
      'bookings?select=id,workspace_id,member_id,start_date_time,end_date_time,booking_status&booking_status=in.(confirmed,pending)',
    );
    expect(bookings.length).toBeGreaterThan(0);

    // Link every real room to some drawn position, in memory only, so every real
    // booking has somewhere to land. Nothing is written back.
    const bookable = SPACES.filter((s) => s.bookable);
    const linked = rooms.map((r, i) => ({ ...r, floorplan_id: bookable[i].id, active: true }));
    const ids = planIdByWorkspace(mergeSpaces(SPACES, linked).spaces);

    let checked = 0;
    for (const b of bookings) {
      const start = Date.parse(b.start_date_time);
      const end = Date.parse(b.end_date_time);
      const day = wallClockAt(start, HUB_TIMEZONE).date;
      if (wallClockAt(end, HUB_TIMEZONE).date !== day) continue; // crosses midnight; covered in unit tests

      const [mapped] = toMapBookings(
        [{ id: b.id, workspaceId: b.workspace_id, startUtc: b.start_date_time, endUtc: b.end_date_time, mine: false, pending: false }],
        day, HUB_TIMEZONE, ids,
      ).bookings;
      expect(mapped, b.id).toBeDefined();

      const from = wallClockAt(start, HUB_TIMEZONE).mins;
      const to = wallClockAt(end, HUB_TIMEZONE).mins;
      const back = windowToUtcRange(day, from, to, HUB_TIMEZONE);
      expect(Date.parse(back.startISO), b.id).toBe(start);
      expect(Date.parse(back.endISO), b.id).toBe(end);
      // No identity crosses into the map.
      expect(JSON.stringify(mapped)).not.toContain(b.member_id);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    console.log(`round-tripped ${checked} of ${bookings.length} live bookings`);
  });
});
