-- Floor-plan columns for workspaces.
-- Paste this whole file into Supabase > SQL Editor and click Run.
-- Additive and safe to re-run. Shapes stay in code; floorplan_id links a room to its spot on the plan.

begin;

alter table public.workspaces
  add column if not exists floorplan_id text,  -- spot on the plan; null = not placed yet
  add column if not exists code text,          -- label drawn on the plan, e.g. MR-A
  add column if not exists kind text,          -- meeting_room, phone_booth, ...
  add column if not exists space_group text,   -- desks / rooms / offices / facilities
  add column if not exists bookable boolean not null default true,
  add column if not exists zone text,
  add column if not exists description text,
  add column if not exists min_minutes integer,  -- per-room booking limits
  add column if not exists max_minutes integer,
  add column if not exists active boolean not null default true;  -- soft delete

-- One room per spot on the plan.
create unique index if not exists workspaces_floorplan_id_key
  on public.workspaces (floorplan_id)
  where floorplan_id is not null;

-- Only allow values the app understands.
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

-- Existing rooms are meeting rooms.
update public.workspaces
set
  kind        = coalesce(kind, 'meeting_room'),
  space_group = coalesce(space_group, 'rooms'),
  zone        = coalesce(zone, location),
  description = coalesce(description, equipment)
where kind is null or space_group is null or zone is null or description is null;

commit;

-- To check it worked, run this on its own afterwards:
-- select name, kind, space_group, bookable, active, floorplan_id from public.workspaces order by name;
