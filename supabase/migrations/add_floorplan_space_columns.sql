-- Run this once in Supabase Dashboard -> SQL Editor.
--
-- Phase 2 of folding the floor-plan map into the hub: give `workspaces` the columns
-- the map needs, so a space on the plan and a bookable room are the same row.
--
-- Deliberately NOT a new `spaces` table. Two tables both meaning "a bookable thing"
-- would leave bookings pointing at one of them, and the assistant, invoices, admin
-- screens and Stripe all needing to know which. The assistant's RoomOption type is
-- already {id, name, location, capacity, pricePerHour, amenities} -- an exact match
-- for columns that exist here -- so extending this table means it keeps working with
-- no changes at all.
--
-- Every column is nullable or defaulted, so the five existing rows stay valid and
-- nothing reads these yet. Additive and reversible: `alter table workspaces drop
-- column ...` undoes it.
--
-- Geometry is absent on purpose. `shape` is a polygon traced from the floor drawing;
-- it changes when the building changes, not when someone renames a room. It stays in
-- features/booking-map/floorplan/, and `floorplan_id` is the join.

begin;

alter table public.workspaces
  -- Join key to the polygon in code. Null = a room that exists but isn't drawn on
  -- the plan yet, which must stay bookable through the ordinary booking page.
  add column if not exists floorplan_id text,

  -- Short label drawn inside the shape: "MR-A", "1.D+E", "PB-2".
  add column if not exists code text,

  -- Drives the icon, the plan fill and the sidebar grouping.
  add column if not exists kind text,

  -- The filter chips: desks / rooms / offices / facilities. Named space_group
  -- because `group` is a reserved word in SQL.
  add column if not exists space_group text,

  -- Kitchens, stairwells and washrooms are drawn but can never be booked.
  add column if not exists bookable boolean not null default true,

  add column if not exists zone text,
  add column if not exists description text,

  -- Per-space booking limits, in minutes. Null = fall back to the venue default.
  add column if not exists min_minutes integer,
  add column if not exists max_minutes integer,

  -- Soft delete. A hard delete would orphan bookings and payments, so retiring a
  -- room flips this instead.
  add column if not exists active boolean not null default true;

-- One plan position holds one space. Partial, so the many rooms with no plan
-- position yet don't all collide on null.
create unique index if not exists workspaces_floorplan_id_key
  on public.workspaces (floorplan_id)
  where floorplan_id is not null;

-- Vocabularies, enforced in the database rather than trusted from the client.
-- Written as NOT VALID + VALIDATE so the check is applied to existing rows
-- explicitly and a bad legacy row surfaces here rather than at the first insert.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_kind_check') then
    alter table public.workspaces
      add constraint workspaces_kind_check check (
        kind is null or kind in (
          'desk', 'workpoint', 'collab_table', 'lounge_pod', 'team_bay', 'phone_booth',
          'meeting_room', 'boardroom', 'training_room', 'private_office', 'amenity'
        )
      ) not valid;
    alter table public.workspaces validate constraint workspaces_kind_check;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'workspaces_space_group_check') then
    alter table public.workspaces
      add constraint workspaces_space_group_check check (
        space_group is null or space_group in ('desks', 'rooms', 'offices', 'facilities')
      ) not valid;
    alter table public.workspaces validate constraint workspaces_space_group_check;
  end if;

  -- A zero or negative minimum, or a maximum below the minimum, makes every booking
  -- impossible for that space -- and silently, since the UI just refuses.
  if not exists (select 1 from pg_constraint where conname = 'workspaces_duration_check') then
    alter table public.workspaces
      add constraint workspaces_duration_check check (
        (min_minutes is null or min_minutes > 0)
        and (max_minutes is null or max_minutes > 0)
        and (min_minutes is null or max_minutes is null or max_minutes >= min_minutes)
      ) not valid;
    alter table public.workspaces validate constraint workspaces_duration_check;
  end if;
end $$;

-- Backfill the five existing rooms. They are all real, bookable meeting rooms, so
-- the defaults are honest rather than placeholder. floorplan_id stays null: which
-- plan position each one occupies is an admin decision, made in the UI in phase 5.
update public.workspaces
set
  kind        = coalesce(kind, 'meeting_room'),
  space_group = coalesce(space_group, 'rooms'),
  zone        = coalesce(zone, location),
  description = coalesce(description, equipment)
where kind is null or space_group is null or zone is null or description is null;

commit;


-- ---------------------------------------------------------------------------
-- Verification (read-only -- run after the COMMIT above).
-- Expect: 5 rows, every one bookable + active, kind/space_group populated.
-- ---------------------------------------------------------------------------
-- select name, code, kind, space_group, zone, bookable, active, floorplan_id
-- from public.workspaces
-- order by name;
