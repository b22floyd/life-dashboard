create table public.dashboard_section_order (
  user_id uuid primary key references auth.users(id) on delete cascade,
  section_order text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.dashboard_section_order enable row level security;

create policy "Users can view their own dashboard section order"
  on public.dashboard_section_order for select
  using (auth.uid() = user_id);

create policy "Users can insert their own dashboard section order"
  on public.dashboard_section_order for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own dashboard section order"
  on public.dashboard_section_order for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
