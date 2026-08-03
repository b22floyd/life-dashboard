create table public.todoist_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_project_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.todoist_preferences enable row level security;

create policy "Users can view their own Todoist preferences"
  on public.todoist_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own Todoist preferences"
  on public.todoist_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Todoist preferences"
  on public.todoist_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
