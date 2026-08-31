-- session_exercises had select/insert/delete policies but no update policy,
-- so renaming an exercise (which is how merging duplicate spellings works —
-- exercise_name is free text, and both the progress chart and history read
-- it directly) would silently affect zero rows under RLS.
create policy "Users can update their own session exercises"
  on public.session_exercises for update
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_exercises.session_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_sessions s
    where s.id = session_exercises.session_id and s.user_id = auth.uid()
  ));
