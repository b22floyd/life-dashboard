-- Annual Goals: a handful of yearly goals, each with four fixed quarterly
-- checkpoints (targets defined at creation, marked complete as they're
-- achieved) and a running log of check-in notes.
create table public.annual_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.goal_checkpoints (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.annual_goals(id) on delete cascade,
  quarter text not null check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  target_description text not null default '',
  completed boolean not null default false,
  completed_at timestamptz,
  unique (goal_id, quarter)
);

create table public.goal_checkin_notes (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.annual_goals(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index goal_checkpoints_goal_id_idx on public.goal_checkpoints (goal_id);
create index goal_checkin_notes_goal_id_created_at_idx
  on public.goal_checkin_notes (goal_id, created_at desc);

alter table public.annual_goals enable row level security;
alter table public.goal_checkpoints enable row level security;
alter table public.goal_checkin_notes enable row level security;

create policy "Users can view their own annual goals"
  on public.annual_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own annual goals"
  on public.annual_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own annual goals"
  on public.annual_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own annual goals"
  on public.annual_goals for delete
  using (auth.uid() = user_id);

-- goal_checkpoints and goal_checkin_notes have no user_id of their own —
-- ownership is checked via a join back to annual_goals, same pattern as
-- session_exercises -> workout_sessions. Delete policies are included here
-- from the start (not as a follow-up migration): RLS still applies to rows
-- removed via "on delete cascade", so deleting a goal needs delete policies
-- on both child tables too, not just the parent.
create policy "Users can view their own goal checkpoints"
  on public.goal_checkpoints for select
  using (
    exists (
      select 1 from public.annual_goals
      where id = goal_id and user_id = auth.uid()
    )
  );

create policy "Users can insert their own goal checkpoints"
  on public.goal_checkpoints for insert
  with check (
    exists (
      select 1 from public.annual_goals
      where id = goal_id and user_id = auth.uid()
    )
  );

create policy "Users can update their own goal checkpoints"
  on public.goal_checkpoints for update
  using (
    exists (
      select 1 from public.annual_goals
      where id = goal_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.annual_goals
      where id = goal_id and user_id = auth.uid()
    )
  );

create policy "Users can delete their own goal checkpoints"
  on public.goal_checkpoints for delete
  using (
    exists (
      select 1 from public.annual_goals
      where id = goal_id and user_id = auth.uid()
    )
  );

create policy "Users can view their own goal check-in notes"
  on public.goal_checkin_notes for select
  using (
    exists (
      select 1 from public.annual_goals
      where id = goal_id and user_id = auth.uid()
    )
  );

create policy "Users can insert their own goal check-in notes"
  on public.goal_checkin_notes for insert
  with check (
    exists (
      select 1 from public.annual_goals
      where id = goal_id and user_id = auth.uid()
    )
  );

create policy "Users can delete their own goal check-in notes"
  on public.goal_checkin_notes for delete
  using (
    exists (
      select 1 from public.annual_goals
      where id = goal_id and user_id = auth.uid()
    )
  );
