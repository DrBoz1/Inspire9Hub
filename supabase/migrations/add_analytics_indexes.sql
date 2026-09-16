-- Run this once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- Indexes for the insights page, which always queries a date range and often
-- narrows to one room. Without these every report is a sequential scan of the
-- whole bookings table, which gets slower every week the hub operates.

-- "bookings in this window", the shape of every insights query.
create index if not exists bookings_start_date_time_idx
  on bookings (start_date_time);

-- "this room, in this window" -- the per-room utilisation breakdown.
-- Column order matters: workspace_id first so the equality narrows before the
-- range scan.
create index if not exists bookings_workspace_start_idx
  on bookings (workspace_id, start_date_time);

-- Confirmed vs cancelled is the split behind both utilisation and the
-- cancellation rate, and confirmed rows are the majority, so this earns its
-- keep mainly on the cancelled side.
create index if not exists bookings_status_idx
  on bookings (booking_status);

-- Revenue over time. payment_date is a bare DATE, so this is day-granular --
-- which is all the revenue series needs.
create index if not exists payments_payment_date_idx
  on payments (payment_date);

-- Verify afterwards (read-only):
-- select indexname, tablename from pg_indexes
--   where schemaname = 'public' and tablename in ('bookings', 'payments')
--   order by tablename, indexname;
