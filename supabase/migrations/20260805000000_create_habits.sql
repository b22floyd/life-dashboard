create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index habits_user_id_position_idx
  on public.habits (user_id, position);

create table public.daily_habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_date)
);

alter table public.habits enable row level security;
alter table public.daily_habit_completions enable row level security;

create policy "Users can view their own habits"
  on public.habits for select
  using (auth.uid() = user_id);

create policy "Users can insert their own habits"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own habits"
  on public.habits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own habits"
  on public.habits for delete
  using (auth.uid() = user_id);

-- daily_habit_completions has no user_id column of its own — ownership is
-- checked by joining back to habits, same pattern as session_exercises
-- checking through workout_sessions.
create policy "Users can view their own habit completions"
  on public.daily_habit_completions for select
  using (exists (
    select 1 from public.habits h
    where h.id = daily_habit_completions.habit_id and h.user_id = auth.uid()
  ));

create policy "Users can insert their own habit completions"
  on public.daily_habit_completions for insert
  with check (exists (
    select 1 from public.habits h
    where h.id = daily_habit_completions.habit_id and h.user_id = auth.uid()
  ));

create policy "Users can delete their own habit completions"
  on public.daily_habit_completions for delete
  using (exists (
    select 1 from public.habits h
    where h.id = daily_habit_completions.habit_id and h.user_id = auth.uid()
  ));

-- Seed the starting habits, in the requested display order. Assumes a
-- single existing account — same single-user assumption used when
-- journal_entries was first scoped to a user.
insert into public.habits (user_id, name, position)
select (select id from auth.users limit 1), name, position
from (values
  ('Make the bed', 0),
  ('Skin care routine', 1),
  ('15 min reading', 2),
  ('Inbox zero', 3),
  ('Workout', 4),
  ('Mobility work', 5),
  ('Track spending', 6),
  ('Daily journal', 7)
) as seed(name, position);
