-- Push subscriptions table for PWA web push notifications
-- Run this in Supabase SQL Editor

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  endpoint    text not null unique,
  business_id text not null,
  user_id     text,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_business_id_idx
  on push_subscriptions (business_id);

-- Optional: row-level security (public insert allowed via service role key in API)
alter table push_subscriptions enable row level security;

create policy "Service role full access"
  on push_subscriptions
  for all
  using (true)
  with check (true);
