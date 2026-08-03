-- Routine Cleaning Reminders: a simple recurring checklist, no streak
-- tracking. cleaning_tasks holds the task list; cleaning_task_completions
-- is an append-only log of when each task was marked done — "due" status
-- is derived at read time from the most recent completion plus the task's
-- frequency, rather than stored as a mutable flag.
create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  created_at timestamptz not null default now()
);

create table public.cleaning_task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.cleaning_tasks(id) on delete cascade,
  completed_at timestamptz not null default now()
);

create index cleaning_task_completions_task_id_completed_at_idx
  on public.cleaning_task_completions (task_id, completed_at desc);

alter table public.cleaning_tasks enable row level security;
alter table public.cleaning_task_completions enable row level security;

create policy "Users can view their own cleaning tasks"
  on public.cleaning_tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own cleaning tasks"
  on public.cleaning_tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own cleaning tasks"
  on public.cleaning_tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own cleaning tasks"
  on public.cleaning_tasks for delete
  using (auth.uid() = user_id);

-- cleaning_task_completions has no user_id of its own — ownership is
-- checked via a join back to cleaning_tasks, same pattern as
-- daily_habit_completions -> habits.
create policy "Users can view their own cleaning task completions"
  on public.cleaning_task_completions for select
  using (
    exists (
      select 1 from public.cleaning_tasks
      where id = task_id and user_id = auth.uid()
    )
  );

create policy "Users can insert their own cleaning task completions"
  on public.cleaning_task_completions for insert
  with check (
    exists (
      select 1 from public.cleaning_tasks
      where id = task_id and user_id = auth.uid()
    )
  );

create policy "Users can delete their own cleaning task completions"
  on public.cleaning_task_completions for delete
  using (
    exists (
      select 1 from public.cleaning_tasks
      where id = task_id and user_id = auth.uid()
    )
  );
