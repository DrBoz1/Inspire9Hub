-- Run this once in Supabase Dashboard -> SQL Editor.
-- regular_price_per_hour is the stable "normal" price baseline used to detect
-- price drops. It only changes when an admin explicitly opts in (see
-- app/(admin)/admin/rooms/actions.ts) -- editing price_per_hour alone never
-- moves it, so the drop badge can't drift no matter how many times the price
-- is changed.
alter table workspaces
  add column if not exists regular_price_per_hour numeric,
  add column if not exists show_rating boolean not null default true;

-- Backfill: every existing room's current price becomes its own baseline,
-- so no false "price drop" badges appear the moment this migration runs.
update workspaces
  set regular_price_per_hour = price_per_hour
  where regular_price_per_hour is null;
