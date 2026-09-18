-- Run this once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- People who aren't members yet: someone who enquired on the website, walked in,
-- or was referred. Until now every row in the database was already a signed-up
-- member, so an enquiry had nowhere to live and was lost.

create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),

  name             text not null check (char_length(name) between 1 and 120),
  email            text not null check (char_length(email) between 3 and 254),
  phone            text check (phone is null or char_length(phone) <= 30),
  company          text check (company is null or char_length(company) <= 120),

  -- What they're after, and how big a team: the two things that decide which
  -- space to show them on a tour.
  interest         text not null default 'other'
                   check (interest in ('hot_desk', 'dedicated_desk', 'private_office', 'meeting_room', 'event', 'other')),
  team_size        integer check (team_size is null or team_size between 1 and 500),
  message          text check (message is null or char_length(message) <= 2000),

  -- How the lead reached us (the form, a walk-in) and how they first heard of
  -- us (search, a friend). Different questions: the first is our process, the
  -- second is marketing, and the report splits wins by both.
  source           text not null default 'website'
                   check (source in ('website', 'support_form', 'walk_in', 'referral', 'phone', 'email', 'event', 'other')),
  heard_via        text check (heard_via is null or heard_via in ('search', 'social', 'friend', 'passing', 'event', 'other')),

  stage            text not null default 'new'
                   check (stage in ('new', 'contacted', 'tour_booked', 'trial', 'won', 'lost')),
  -- The furthest the lead got along new -> contacted -> tour_booked -> trial -> won.
  -- Only ever moves forward. Without it a lead that toured and was then lost
  -- would count as nothing more than "lost", and the funnel would under-count
  -- every step it passed through.
  furthest_stage   text not null default 'new'
                   check (furthest_stage in ('new', 'contacted', 'tour_booked', 'trial', 'won')),
  lost_reason      text check (lost_reason is null or lost_reason in ('price', 'location', 'timing', 'competitor', 'no_response', 'not_a_fit', 'other')),

  -- The member of staff looking after them. Kept if that person leaves.
  owner_id         uuid references admins(id) on delete set null,
  -- Set when a lead becomes a member, linking the enquiry to what they spend.
  member_id        uuid references members(id) on delete set null,
  next_follow_up   date,

  -- Anything logged against the lead moves this forward; "gone quiet" is
  -- measured from it.
  last_activity_at timestamptz not null default now(),
  -- When it was won or lost, for "days from enquiry to member". Cleared if the
  -- lead is reopened.
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One OPEN lead per email address. Someone who fills in the form twice gets a
-- note on their existing lead rather than a duplicate. Once a lead is won or
-- lost, the same person enquiring a year later starts a fresh one.
create unique index if not exists leads_open_email_key
  on leads (lower(email))
  where stage not in ('won', 'lost');

create index if not exists leads_stage_idx on leads (stage);
create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_follow_up_idx on leads (next_follow_up)
  where next_follow_up is not null and stage not in ('won', 'lost');

-- The history of a lead: notes, calls, tours, and every stage change.
create table if not exists lead_notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  -- No foreign key, like admin_audit: a note must survive its author leaving.
  -- The name is kept so it still reads correctly afterwards. Null author means
  -- the system wrote it (for example, a repeat enquiry from the website).
  author_id   uuid,
  author_name text,
  kind        text not null default 'note'
              check (kind in ('note', 'call', 'email', 'tour', 'stage', 'enquiry')),
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists lead_notes_lead_idx on lead_notes (lead_id, created_at desc);

-- RLS on with NO policies: deny-all for anon and signed-in users alike. The
-- public enquiry form writes through a server action using the service-role
-- client after validating everything itself, so nothing here needs direct
-- browser access, and a leaked publishable key can't read anyone's enquiry.
alter table leads enable row level security;
alter table lead_notes enable row level security;

-- Verify afterwards (read-only):
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('leads', 'lead_notes');
