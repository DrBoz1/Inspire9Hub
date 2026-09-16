-- Run this once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- A record of what staff did. community_entries is the only log today and it
-- covers induction decisions and successful bookings -- not cancellations,
-- refunds, price changes, or who was given admin access.

create table if not exists admin_audit (
  id          uuid primary key default gen_random_uuid(),

  -- No foreign key, deliberately: an audit row must survive the deletion of
  -- the person it describes, otherwise removing a staff member erases the
  -- record of what they did. actor_email is captured at write time for the
  -- same reason -- it still reads correctly after the admins row is gone.
  actor_id    uuid,
  actor_email text,

  -- What happened, as a stable machine key: 'booking.cancel', 'room.update',
  -- 'staff.add'. Grouped by entity so a member's whole history can be pulled
  -- with one indexed lookup.
  action      text not null,
  entity      text not null,
  entity_id   uuid,

  -- One human-readable line, written at the call site where the context is
  -- known. Rendering an audit row must never require re-querying anything.
  summary     text not null,

  -- Anything structured worth keeping (amounts, before/after values) without
  -- needing a migration per action type.
  meta        jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_created_at_idx
  on admin_audit (created_at desc);

create index if not exists admin_audit_entity_idx
  on admin_audit (entity, entity_id);

-- RLS on with NO policies at all. That is deny-all for both anon and
-- authenticated: only the service-role client can read or write, which is how
-- every admin loader already works (createAdminClient + requireAdmin in app
-- code). An audit log readable by the people it audits would be pointless.
alter table admin_audit enable row level security;

-- Verify afterwards (read-only):
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename = 'admin_audit';
