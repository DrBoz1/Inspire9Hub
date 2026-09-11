'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { HUB_TIMEZONE } from '@/lib/datetime';
import { dayBoundsUtc, isDateKey } from './zoned-time';
import type { DayBookingRow } from './adapter';

export type DayResult =
  | { ok: true; day: string; rows: DayBookingRow[] }
  | { ok: false; day: string; error: string };

/**
 * Every live booking that overlaps one hub-local day, for the floor plan.
 *
 * A Server Function is a public POST endpoint, not just something the map calls,
 * so this checks the caller and the input itself rather than trusting either.
 *
 * Read-only. Uses the admin client because availability needs *everyone's*
 * bookings and RLS rightly shows a member only their own -- the same reason
 * checkRoomAvailability does. What leaves this function is deliberately thin: room,
 * times, and whether it's the caller's. No member ids, no names.
 */
export async function getMapDay(day: string): Promise<DayResult> {
  if (typeof day !== 'string' || !isDateKey(day)) {
    return { ok: false, day: String(day), error: 'That isn’t a valid date.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, day, error: 'Sign in to see availability.' };

  // A Melbourne day, as UTC instants -- 23 or 25 hours long on DST days.
  const { start, end } = dayBoundsUtc(day, HUB_TIMEZONE);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bookings')
    .select('id, workspace_id, member_id, start_date_time, end_date_time, booking_status')
    // The same two statuses the bookings_no_overlap constraint treats as occupying
    // a room. Cancelled bookings free their slot.
    .in('booking_status', ['confirmed', 'pending'])
    // Overlap, not containment: a booking that started yesterday and runs into
    // today still occupies today.
    .lt('start_date_time', new Date(end).toISOString())
    .gt('end_date_time', new Date(start).toISOString())
    .limit(2000);

  if (error) {
    console.error('[floor plan] loading bookings failed:', error.message);
    return { ok: false, day, error: 'Couldn’t load bookings for this day. Try again.' };
  }

  const rows: DayBookingRow[] = [];
  for (const b of data ?? []) {
    if (!b.workspace_id || !b.start_date_time || !b.end_date_time) continue;
    rows.push({
      id: b.id,
      workspaceId: b.workspace_id,
      startUtc: b.start_date_time,
      endUtc: b.end_date_time,
      mine: b.member_id === user.id,
      pending: b.booking_status === 'pending',
    });
  }
  return { ok: true, day, rows };
}
