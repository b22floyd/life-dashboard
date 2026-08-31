-- One row per subscribed browser/device (a user could enable notifications
-- on both their phone and laptop). endpoint is the push service URL the
-- browser issued; p256dh/auth are the per-subscription encryption keys Web
-- Push requires to encrypt a payload for that specific subscription.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can view their own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

-- Subscribing again from the same browser (re-enabling after a permission
-- reset, a redeployed VAPID key, etc.) upserts onto (user_id, endpoint) —
-- needs an update policy alongside insert, or a re-subscribe would silently
-- affect zero rows under RLS the same way session_exercises did before its
-- own update policy was added.
create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
