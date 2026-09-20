-- Run this once in Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- Day passes: the 36 hot desks in banks A to F become bookable, a day at a time.
--
-- Each desk is a workspace linked to its spot on the floor plan (desk-A1 to
-- desk-F6), so a day pass is an ordinary booking of one desk for the day's
-- opening hours. The bookings_no_overlap rule that stops double bookings also
-- stops a desk being sold twice, which caps the passes a day can sell at the
-- number of desks without any counting that could race.
--
-- Desks go on sale once they have a day price. Set it in Admin -> Space
-- management, or uncomment the update at the bottom of this file.

-- A desk's price for one day. Null means not on sale. Rooms keep price_per_hour.
alter table public.workspaces add column if not exists price_per_day numeric(10, 2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_price_per_day_check') then
    alter table public.workspaces
      add constraint workspaces_price_per_day_check check (price_per_day is null or price_per_day > 0);
  end if;
end $$;

-- The desks. price_per_hour is left at its default and never used for a desk:
-- checkout charges a desk its day price.
insert into public.workspaces
  (name, code, kind, space_group, capacity, location, zone, equipment, description, amenities, floorplan_id, bookable, active)
select
  'Desk ' || bank.letter || seat.n,
  bank.letter || seat.n,
  'desk',
  'desks',
  1,
  'Level 1',
  bank.zone,
  'Sit-stand desk, monitor arm, power',
  'Sit-stand hot desk in bank ' || bank.letter || ', south workstation zone. Monitor arm, under-desk power and locker access.',
  array['monitor', 'power', 'daylight', 'wifi'],
  'desk-' || bank.letter || seat.n,
  true,
  true
from (values ('A', 'West Wing'), ('B', 'West Wing'), ('C', 'West Wing'),
             ('D', 'East Wing'), ('E', 'East Wing'), ('F', 'East Wing')) as bank(letter, zone)
cross join generate_series(1, 6) as seat(n)
-- One workspace per spot on the plan (workspaces_floorplan_id_key): re-running adds nothing.
on conflict (floorplan_id) where floorplan_id is not null do nothing;

-- Optional: put every desk on sale now at one price (AUD per day).
-- update public.workspaces set price_per_day = 35 where kind = 'desk';

-- To check it worked, run this on its own afterwards:
-- select count(*) as desks, count(price_per_day) as on_sale from public.workspaces where kind = 'desk';
