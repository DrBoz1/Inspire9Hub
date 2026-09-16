-- Run this once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- Fills in what the payments table never recorded about a Stripe charge.
-- Every column here already exists as a value we hold at write time and throw
-- away, so nothing needs backfilling from the Stripe API.

alter table payments
  -- Hardcoded 'aud' in the Stripe call today, so revenue sums silently assume
  -- one currency. Storing it means a future second currency can't quietly be
  -- added into an AUD total. Lowercase-enforced so an 'AUD' row can never miss
  -- a `= 'aud'` filter and drop out of a revenue figure.
  add column if not exists currency text not null default 'aud',
  -- The refund's own id. Without it a refund can't be traced back to Stripe,
  -- and a retry after a partial failure can't tell what already went through.
  add column if not exists stripe_refund_id text,
  -- payment_date is a bare DATE, so a same-day refund is indistinguishable
  -- from the payment. This is the actual instant.
  add column if not exists refunded_at timestamptz,
  -- The session that produced the charge, for tracing a payment back through
  -- the webhook to the checkout that created it.
  add column if not exists stripe_checkout_session_id text;

alter table payments
  drop constraint if exists payments_currency_lowercase;
alter table payments
  add constraint payments_currency_lowercase check (currency = lower(currency));

-- Verify afterwards (read-only):
-- select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'payments'
--   order by ordinal_position;
