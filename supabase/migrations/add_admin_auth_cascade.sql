-- Run this once in Supabase Dashboard -> SQL Editor.
--
-- public.admins.id was a bare primary key defaulting to gen_random_uuid(), with no
-- link to auth.users at all. Deleting a login from the Auth dashboard therefore left
-- the admins row behind, and Staff Management kept listing someone who could no
-- longer sign in. This ties the two together so Auth deletions clean up after
-- themselves.
--
-- The two child tables have to be handled in the same breath. Once admins rows start
-- disappearing via cascade, a child FK left at the default NO ACTION would *block*
-- that cascade -- and the auth.users delete would then fail outright, which is worse
-- than the bug being fixed. So both rules are set explicitly:
--
--   super_admins.admin_id    -> CASCADE   a tier marker, meaningless without the
--                                         admin it points at (and NOT NULL, so
--                                         SET NULL isn't available anyway)
--   announcements.created_by -> SET NULL  an announcement is hub content, not staff
--                                         content -- it outlives whoever posted it
--
-- members.id is deliberately left alone. It has six child tables including payments
-- (Stripe-backed) and bookings; cascading a member delete would destroy financial
-- history. That needs a real archival design, not a constraint.

begin;

-- Refuse to run against violating data rather than half-applying it.
do $$
declare
  orphans int;
begin
  select count(*) into orphans
  from public.admins a
  where not exists (select 1 from auth.users u where u.id = a.id);

  if orphans > 0 then
    raise exception
      'Aborting: % admins row(s) have no auth.users match. Clear them with Clean Up on /admin/management, then re-run.',
      orphans;
  end if;
end $$;

-- SET NULL below needs a nullable column. Already nullable -> no-op, no error.
alter table public.announcements alter column created_by drop not null;

-- Drop the existing child FKs by lookup rather than by hardcoded name: correct
-- whatever they happen to be called, and it makes this script safe to run twice.
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where contype = 'f'
      and conrelid = 'public.super_admins'::regclass
      and confrelid = 'public.admins'::regclass
  loop
    execute format('alter table public.super_admins drop constraint %I', c);
  end loop;

  for c in
    select conname from pg_constraint
    where contype = 'f'
      and conrelid = 'public.announcements'::regclass
      and confrelid = 'public.admins'::regclass
  loop
    execute format('alter table public.announcements drop constraint %I', c);
  end loop;

  for c in
    select conname from pg_constraint
    where contype = 'f'
      and conrelid = 'public.admins'::regclass
      and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.admins drop constraint %I', c);
  end loop;
end $$;

alter table public.super_admins
  add constraint super_admins_admin_id_fkey
  foreign key (admin_id) references public.admins(id) on delete cascade;

alter table public.announcements
  add constraint announcements_created_by_fkey
  foreign key (created_by) references public.admins(id) on delete set null;

alter table public.admins
  add constraint admins_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- An admin's id must now be an existing auth user's id, so a random default is a
-- footgun -- it could only ever produce a foreign key violation. createAdmin() in
-- app/(admin)/actions.ts always passes the id explicitly, so nothing relies on it.
alter table public.admins alter column id drop default;

commit;


-- ---------------------------------------------------------------------------
-- Verification (read-only -- run separately after the COMMIT above succeeds).
-- Expected: three rows, on_delete = CASCADE / SET NULL / CASCADE.
-- ---------------------------------------------------------------------------
-- select
--   child.relname || '.' || att.attname              as child_column,
--   parent_ns.nspname || '.' || parent.relname       as references_table,
--   case con.confdeltype
--     when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE'
--     when 'n' then 'SET NULL'  when 'd' then 'SET DEFAULT'
--   end                                              as on_delete
-- from pg_constraint con
-- join pg_class child      on child.oid  = con.conrelid
-- join pg_class parent     on parent.oid = con.confrelid
-- join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
-- join unnest(con.conkey) with ordinality k(attnum, ord) on true
-- join pg_attribute att    on att.attrelid = child.oid and att.attnum = k.attnum
-- where con.contype = 'f'
--   and child.relname in ('admins', 'super_admins', 'announcements')
-- order by child.relname;
