-- Run this once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- Monthly memberships, billed by Stripe. Until now every charge was a one-off
-- per booking, so there was no way to sell a desk by the month.
--
-- All money here is INTEGER CENTS, unlike payments.amount (dollars). Every
-- number in these tables is compared against, or copied from, a Stripe amount,
-- and Stripe works in cents; converting back and forth is where rounding bugs live.
--
-- Stripe is the source of truth. These tables are a mirror the app can read
-- quickly, written only by the webhook and the admin "sync plans" button.

-- ─── members.stripe_customer_id ─────────────────────────────────────────────
alter table members add column if not exists stripe_customer_id text;

-- One Stripe customer per member. Two members sharing a customer is how a
-- double charge happens, and the database is the only place that race can be
-- closed for certain (the same reasoning as bookings_no_overlap).
create unique index if not exists members_stripe_customer_id_key
  on members (stripe_customer_id)
  where stripe_customer_id is not null;

-- ─── plans ───────────────────────────────────────────────────────────────────
-- The memberships on sale: a copy of Stripe Prices tagged with
-- metadata.hub_plan_slug. Never typed by hand; the admin "Sync from Stripe"
-- button writes it, so it can't drift from what Stripe actually charges.
create table if not exists plans (
  id                uuid primary key default gen_random_uuid(),
  -- A stable key ('resident', 'flexi') for links and code, so renaming the
  -- plan in Stripe never breaks anything. Unique among plans on sale only (see
  -- below): a price change leaves the old plan switched off under the same slug.
  slug              text not null,
  name              text not null,
  description       text,
  stripe_product_id text not null,
  stripe_price_id   text not null unique,
  -- Stripe never changes a Price's amount; a new price is a new Price, which
  -- becomes a new plan row while the old one is switched off. That keeps
  -- existing members on what they signed up for.
  amount_cents      integer not null check (amount_cents >= 0),
  -- Lower case enforced, so an 'AUD' row can't slip past a currency = 'aud' filter.
  currency          text not null check (currency = lower(currency)),
  -- "interval" is a reserved word in Postgres, hence billing_interval.
  billing_interval  text not null check (billing_interval in ('month', 'year')),
  -- A quarterly plan is ('month', 3). Without this it would count three times over in MRR.
  interval_count    integer not null default 1 check (interval_count > 0),
  -- Hidden from the join page, but kept: members may still be on it.
  active            boolean not null default true,
  sort_order        integer not null default 0,
  -- Off room bookings for members on this plan, from the price's
  -- metadata.hub_booking_discount. A plain percentage rather than room credits:
  -- every booking is still paid for, so refunds work exactly as before.
  booking_discount_percent integer not null default 0 check (booking_discount_percent between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One plan per slug on sale. Changing a price in Stripe means a new Price with
-- the same slug; the old plan is switched off first, and both rows are kept.
create unique index if not exists plans_active_slug_key on plans (slug) where active;

-- ─── subscriptions ───────────────────────────────────────────────────────────
create table if not exists subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  -- No cascade: deleting a member must neither erase their billing history
  -- nor leave Stripe quietly charging them (see add_admin_auth_cascade.sql).
  member_id                 uuid not null references members(id),
  stripe_subscription_id    text not null unique,
  stripe_customer_id        text not null,
  -- Null when someone was put on a price in the Stripe Dashboard that isn't one
  -- of our plans; the row still has to exist, or they'd be paying invisibly.
  plan_id                   uuid references plans(id),
  stripe_price_id           text not null,
  -- Stripe's own status word, stored as-is. What it means for the member
  -- (active, grace period, lapsed) is worked out in lib/billing/state.ts, so
  -- changing that rule is a code change, not a data migration.
  status                    text not null,
  -- From the subscription ITEM: Stripe no longer puts this on the subscription itself.
  current_period_end        timestamptz,
  -- Cancelled, but paid up until current_period_end: still a member until then.
  cancel_at_period_end      boolean not null default false,
  ended_at                  timestamptz,
  -- What THIS subscription pays, copied from Stripe. MRR is worked out from
  -- these, not from plans, because a member who joined before a price rise
  -- still pays the old price.
  unit_amount_cents         integer not null,
  currency                  text not null check (currency = lower(currency)),
  billing_interval          text not null check (billing_interval in ('month', 'year')),
  interval_count            integer not null default 1 check (interval_count > 0),
  quantity                  integer not null default 1 check (quantity > 0),
  -- Stripe doesn't promise to deliver events in order. This holds the time of
  -- the newest event applied (Stripe's clock, in seconds), and an update only
  -- goes through if its event is at least as new. It is what stops a late
  -- "subscription updated" from bringing back a membership that was cancelled.
  last_stripe_event_created bigint not null default 0,
  last_stripe_event_id      text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists subscriptions_member_id_idx on subscriptions (member_id);
create index if not exists subscriptions_stripe_customer_id_idx on subscriptions (stripe_customer_id);

-- At most one membership being paid for at a time. Deliberately only the
-- statuses where a second one really means paying twice: an abandoned first
-- attempt (incomplete) or an old unpaid one must not stop someone rejoining.
create unique index if not exists subscriptions_one_live_per_member
  on subscriptions (member_id)
  where status in ('trialing', 'active', 'past_due');

-- ─── subscription_invoices ───────────────────────────────────────────────────
create table if not exists subscription_invoices (
  id                        uuid primary key default gen_random_uuid(),
  subscription_id           uuid not null references subscriptions(id),
  stripe_invoice_id         text not null unique,
  status                    text not null,
  -- Both, because a failed invoice has something due and nothing paid, and the
  -- member needs to see what they owe. No ">= 0" check: changing plan part-way
  -- through a month produces a credit invoice with a negative amount.
  amount_due_cents          integer not null,
  amount_paid_cents         integer not null,
  currency                  text not null check (currency = lower(currency)),
  -- The period paid FOR, taken from the invoice's line items. The invoice's
  -- own period fields look back one period, so "October" would read "September".
  period_start              timestamptz not null,
  period_end                timestamptz not null,
  -- Stripe's own receipt page, so there's no second PDF invoice system to keep.
  hosted_invoice_url        text,
  -- First invoice, renewal, or a plan change: explains an odd amount.
  billing_reason            text,
  -- When Stripe will try a failed card again.
  next_payment_attempt      timestamptz,
  -- The same ordering guard: a late "payment failed" mustn't mark a paid invoice as failed.
  last_stripe_event_created bigint not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists subscription_invoices_sub_period_idx
  on subscription_invoices (subscription_id, period_start desc);

-- ─── Row level security ──────────────────────────────────────────────────────
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table subscription_invoices enable row level security;

-- Plans are a public price list: anyone may read the ones on sale. Nobody but
-- the server (service role) may write them, because no write policy exists.
drop policy if exists plans_public_read on plans;
create policy plans_public_read on plans
  for select to anon, authenticated
  using (active);

-- Subscriptions and invoices: no policies at all, so nobody but the server can
-- read or write them. Members see their own through server code that checks
-- who's asking, the same way the admin pages already read members.

-- Verify afterwards (read-only):
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('plans', 'subscriptions', 'subscription_invoices');
