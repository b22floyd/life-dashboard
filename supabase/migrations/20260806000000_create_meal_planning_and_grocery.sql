-- One row per (user, day-of-week) — a fixed set of 7 slots that get
-- upserted in place, never inserted fresh each week and never deleted.
create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day_of_week text not null check (day_of_week in (
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  )),
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, day_of_week)
);

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  content text not null,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index grocery_items_user_id_created_at_idx
  on public.grocery_items (user_id, created_at asc);

-- Recurring/staple items, separate from the active list — quick-added to
-- grocery_items with a tap rather than retyped each week.
create table public.grocery_staples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  content text not null,
  created_at timestamptz not null default now()
);

create index grocery_staples_user_id_created_at_idx
  on public.grocery_staples (user_id, created_at asc);

alter table public.meal_plan_entries enable row level security;
alter table public.grocery_items enable row level security;
alter table public.grocery_staples enable row level security;

create policy "Users can view their own meal plan entries"
  on public.meal_plan_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own meal plan entries"
  on public.meal_plan_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own meal plan entries"
  on public.meal_plan_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view their own grocery items"
  on public.grocery_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own grocery items"
  on public.grocery_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own grocery items"
  on public.grocery_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own grocery items"
  on public.grocery_items for delete
  using (auth.uid() = user_id);

create policy "Users can view their own grocery staples"
  on public.grocery_staples for select
  using (auth.uid() = user_id);

create policy "Users can insert their own grocery staples"
  on public.grocery_staples for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own grocery staples"
  on public.grocery_staples for delete
  using (auth.uid() = user_id);
