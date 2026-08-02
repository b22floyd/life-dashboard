create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_date date not null default current_date,
  name text,
  created_at timestamptz not null default now()
);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  set_number integer not null default 1,
  weight numeric not null,
  reps integer not null,
  notes text,
  created_at timestamptz not null default now()
);

create index workout_sessions_user_date_idx
  on public.workout_sessions (user_id, session_date desc, created_at desc);
create index session_exercises_session_id_idx
  on public.session_exercises (session_id, position);
create index exercise_sets_session_exercise_id_idx
  on public.exercise_sets (session_exercise_id, set_number);

alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.exercise_sets enable row level security;

create policy "Users can view their own workout sessions"
  on public.workout_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own workout sessions"
  on public.workout_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own session exercises"
  on public.session_exercises for select
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_exercises.session_id and s.user_id = auth.uid()
  ));

create policy "Users can insert their own session exercises"
  on public.session_exercises for insert
  with check (exists (
    select 1 from public.workout_sessions s
    where s.id = session_exercises.session_id and s.user_id = auth.uid()
  ));

create policy "Users can view their own exercise sets"
  on public.exercise_sets for select
  using (exists (
    select 1 from public.session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where se.id = exercise_sets.session_exercise_id and s.user_id = auth.uid()
  ));

create policy "Users can insert their own exercise sets"
  on public.exercise_sets for insert
  with check (exists (
    select 1 from public.session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where se.id = exercise_sets.session_exercise_id and s.user_id = auth.uid()
  ));
