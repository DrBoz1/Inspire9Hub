'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { HUB_TIMEZONE } from '@/lib/datetime';
import { dayBoundsUtc, isDateKey } from './zoned-time';
import { unstable_rethrow } from 'next/navigation';
import { createCheckoutSession } from '@/app/(dashboard)/bookings/actions';
import { buildCheckout, parseBookRequest, type DayBookingRow } from './adapter';
import { staleHoldCutoff } from '@/lib/booking-rules';

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
    // A hold older than any checkout can last is left over; the next checkout for
    // that slot releases it, so it isn't shown as taken (see lib/booking-rules.ts).
    .or(`booking_status.eq.confirmed,created_at.gte.${staleHoldCutoff(new Date())}`)
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

/**
 * Start Stripe checkout for a window picked on the map.
 *
 * Goes through createCheckoutSession, so it gets the same induction gate, availability
 * check and overlap constraint as the Bookings page. Two differences: the instants are
 * worked out here from wall-clock minutes, and failures come back as values (as the
 * Next docs advise) so the member sees the real reason. On success it redirects to
 * Stripe and never returns.
 */
export async function bookFromMap(input: unknown): Promise<{ ok: false; error: string }> {
  const parsed = parseBookRequest(input);
  if (!parsed.ok) return parsed;
  const req = parsed.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to book.' };

  const { data: room } = await supabase.from('workspaces').select('*').eq('id', req.workspaceId).maybeSingle();
  if (!room) return { ok: false, error: 'That room no longer exists.' };
  if (room.active === false || room.bookable === false) {
    return { ok: false, error: 'This room isn’t open for booking.' };
  }

  try {
    await createCheckoutSession(buildCheckout(room, req, HUB_TIMEZONE));
  } catch (err) {
    unstable_rethrow(err); // the redirect to Stripe
    const message = err instanceof Error && err.message ? err.message : '';
    return { ok: false, error: message || 'Couldn’t start checkout. Try again.' };
  }
  return { ok: false, error: 'Couldn’t start checkout. Try again.' };
}
