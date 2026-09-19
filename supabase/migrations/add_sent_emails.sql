-- Run this once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- Remembers which one-off emails have gone out, so nobody gets the same email
-- twice. Stripe can deliver an event more than once, and out of order; the
-- membership emails (welcome, receipt, payment failed, cancelling, ended) are
-- sent from those events, so each one claims a key here before it is sent.
--
-- Until this has run, those membership emails are held back rather than risk
-- duplicates. Every other email (bookings, enquiries, staff) works without it.

create table if not exists sent_emails (
  -- What was sent, about what: 'membership.welcome:sub_123',
  -- 'membership.receipt:in_456'. The primary key is the whole guard: a second
  -- insert of the same key fails, and the second send never happens.
  key        text primary key,
  kind       text not null,
  recipient  text not null,
  created_at timestamptz not null default now()
);

-- Server only. No policies: browsers can't read or write it, and the
-- service-role client the server uses is not affected by RLS.
alter table sent_emails enable row level security;
