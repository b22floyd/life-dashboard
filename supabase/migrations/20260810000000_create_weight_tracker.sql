-- Weight Tracker (part of the Health card): a goal (weight + target date,
-- one row per user, upserted in place) and a dated weight log (one entry
-- per day, upserted like a meal plan slot — logging again on the same day
-- overwrites that day's value rather than creating a second row).
create table public.weight_goal (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  goal_weight numeric not null,
  target_date date,
  updated_at timestamptz not null default now()
);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  entry_date date not null,
  weight numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index weight_entries_user_id_entry_date_idx
  on public.weight_entries (user_id, entry_date asc);

alter table public.weight_goal enable row level security;
alter table public.weight_entries enable row level security;

create policy "Users can view their own weight goal"
  on public.weight_goal for select
  using (auth.uid() = user_id);

create policy "Users can insert their own weight goal"
  on public.weight_goal for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own weight goal"
  on public.weight_goal for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view their own weight entries"
  on public.weight_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own weight entries"
  on public.weight_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own weight entries"
  on public.weight_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own weight entries"
  on public.weight_entries for delete
  using (auth.uid() = user_id);
