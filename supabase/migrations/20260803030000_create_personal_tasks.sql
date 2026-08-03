create table public.personal_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  content text not null,
  created_at timestamptz not null default now()
);

create index personal_tasks_user_id_created_at_idx
  on public.personal_tasks (user_id, created_at asc);

alter table public.personal_tasks enable row level security;

create policy "Users can view their own personal tasks"
  on public.personal_tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own personal tasks"
  on public.personal_tasks for insert
  with check (auth.uid() = user_id);

-- Completing a task deletes its row rather than flagging it done — there's
-- no "view completed" feature, so nothing needs to be retained.
create policy "Users can delete their own personal tasks"
  on public.personal_tasks for delete
  using (auth.uid() = user_id);
