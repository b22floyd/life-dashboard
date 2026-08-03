-- workout_sessions/session_exercises/exercise_sets only had select+insert
-- policies. RLS applies to rows removed via ON DELETE CASCADE too, so
-- without delete policies on the child tables, deleting a session would
-- fail to cascade to its exercises/sets.
create policy "Users can delete their own workout sessions"
  on public.workout_sessions for delete
  using (auth.uid() = user_id);

create policy "Users can delete their own session exercises"
  on public.session_exercises for delete
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_exercises.session_id and s.user_id = auth.uid()
  ));

create policy "Users can delete their own exercise sets"
  on public.exercise_sets for delete
  using (exists (
    select 1 from public.session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where se.id = exercise_sets.session_exercise_id and s.user_id = auth.uid()
  ));
