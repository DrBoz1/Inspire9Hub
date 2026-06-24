-- Run this once in Supabase Dashboard -> SQL Editor.
-- Adds admin-editable pricing, image, and amenities to workspaces,
-- backfilled with the values that were previously hardcoded in lib/constants.ts.

alter table workspaces
  add column if not exists price_per_hour numeric not null default 25,
  add column if not exists image_url text,
  add column if not exists amenities text[] not null default '{}';

update workspaces set price_per_hour = 25 where name = 'Dream Room';
update workspaces set price_per_hour = 45 where name in ('Elbow Room', 'Green Room');
update workspaces set price_per_hour = 80 where name in ('Boiler Room', 'Pool Room');

update workspaces set amenities = array['whiteboard','tv','ac','wifi']
  where name = 'Dream Room';
update workspaces set amenities = array['whiteboard','ac','wifi','conf_phone']
  where name = 'Elbow Room';
update workspaces set amenities = array['whiteboard','projector','ac','wifi']
  where name = 'Green Room';
update workspaces set amenities = array['whiteboard','tv','ac','wifi','video_conf','conf_phone']
  where name = 'Boiler Room';
update workspaces set amenities = array['whiteboard','tv','projector','ac','wifi','video_conf','conf_phone','catering']
  where name = 'Pool Room';

update workspaces set image_url = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80'
  where image_url is null;
