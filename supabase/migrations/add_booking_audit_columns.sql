-- Run this once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- Records when a booking was made and how it ended, so the insights page can
-- report booking lead time and cancellation timing. Neither is recoverable
-- from the existing columns: cancelling overwrites booking_status in place.

-- created_at is added WITHOUT a default first, then given one. Adding the
-- column and the default in one statement would stamp every existing booking
-- with today's timestamp, which reads as "all our bookings were made at once"
-- and is worse than admitting we don't know. Existing rows stay null; lead
-- time is only reported for bookings made from here on.
alter table bookings add column if not exists created_at timestamptz;
alter table bookings alter column created_at set default now();

alter table bookings
  -- When it was cancelled, as opposed to when it was due to start.
  add column if not exists cancelled_at timestamptz,
  -- Who cancelled: the member themselves, or an admin acting for them.
  -- No foreign key, matching the stance in add_admin_auth_cascade.sql --
  -- deleting a person must not rewrite the history of what they did.
  add column if not exists cancelled_by uuid,
  -- Free text, e.g. "member cancelled, 100% refund" or an admin's reason.
  add column if not exists cancel_reason text;

-- Verify afterwards (read-only):
-- select column_name, data_type, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'bookings'
--   order by ordinal_position;
