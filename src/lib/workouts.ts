import { createClient } from "@/lib/supabase/server";
import type { WorkoutCategory, WorkoutSession, WorkoutSet } from "@/lib/workout-utils";

type RawSession = {
  id: string;
  session_date: string;
  name: string | null;
  category: WorkoutCategory | null;
  created_at: string;
  session_exercises:
    | {
        id: string;
        exercise_name: string;
        position: number;
        exercise_sets: WorkoutSet[] | null;
      }[]
    | null;
};

// Null means "failed to load" — distinct from an empty array (no sessions
// logged yet).
export async function getWorkoutSessions(): Promise<WorkoutSession[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `id, session_date, name, category, created_at,
       session_exercises (
         id, exercise_name, position,
         exercise_sets ( id, set_number, weight, reps )
       )`,
    )
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load workout sessions:", error.message);
    return null;
  }

  return ((data ?? []) as RawSession[]).map((session) => ({
    id: session.id,
    session_date: session.session_date,
    name: session.name,
    category: session.category,
    created_at: session.created_at,
    exercises: (session.session_exercises ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        id: exercise.id,
        exercise_name: exercise.exercise_name,
        position: exercise.position,
        sets: (exercise.exercise_sets ?? []).slice().sort((a, b) => a.set_number - b.set_number),
      })),
  }));
}

export {
  WORKOUT_CATEGORIES,
  type WorkoutCategory,
  type WorkoutSession,
  type WorkoutExercise,
  type WorkoutSet,
} from "@/lib/workout-utils";
