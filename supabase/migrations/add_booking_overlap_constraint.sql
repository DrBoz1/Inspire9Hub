-- Run this once in Supabase Dashboard -> SQL Editor.
--
-- This constraint ALREADY EXISTS on the live database — it was applied directly in
-- the SQL Editor and never captured as a migration. This file records it so a fresh
-- environment (staging, a rebuilt project, a new Supabase org) gets it too. Running
-- it against the current database is a no-op.
--
-- Why it matters: without it, booking is check-then-insert. checkRoomAvailability()
-- runs a SELECT, then createCheckoutSession() runs an INSERT
-- (app/(dashboard)/bookings/actions.ts). Two members clicking Book on the same slot
-- in the same moment both pass the SELECT and both INSERT. The constraint closes
-- that race in the one place it cannot be raced -- the database. The insert path
-- already handles the rejection: bookingError.code === "23P01" -> "This slot was
-- just reserved by someone else."
--
-- Verified behaviour on the live DB (probed 2026-08-26, overlapping windows):
--
--     confirmed vs confirmed .................. BLOCKED (23P01)
--     confirmed vs pending .................... BLOCKED (23P01)
--     pending   vs confirmed .................. BLOCKED (23P01)
--     pending   vs pending .................... BLOCKED (23P01)
--     cancelled vs confirmed .................. allowed  (cancelling frees the slot)
--     confirmed vs cancelled .................. allowed
--     confirmed vs confirmed, different room .. allowed
--
-- The WHERE clause is what makes cancelled bookings release their slot rather than
-- blocking it forever, and '&&' is range overlap: back-to-back bookings (10-11 and
-- 11-12) do NOT collide, because tstzrange is half-open '[)' by default.

-- Exclusion constraints on (equality, range) pairs need btree_gist for the '=' part.
create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_no_overlap'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (
        workspace_id with =,
        tstzrange(start_date_time, end_date_time) with &&
      )
      where (booking_status in ('confirmed', 'pending'));

    raise notice 'bookings_no_overlap created.';
  else
    raise notice 'bookings_no_overlap already present — nothing to do.';
  end if;
end $$;
