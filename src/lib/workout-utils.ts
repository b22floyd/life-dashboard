export type WorkoutSet = {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
};

export type WorkoutExercise = {
  id: string;
  exercise_name: string;
  position: number;
  sets: WorkoutSet[];
};

export const WORKOUT_CATEGORIES = ["Chest", "Back", "Shoulder", "Leg"] as const;
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number];

export type WorkoutSession = {
  id: string;
  session_date: string;
  name: string | null;
  category: WorkoutCategory | null;
  created_at: string;
  exercises: WorkoutExercise[];
};

export function getExerciseNames(sessions: WorkoutSession[]): string[] {
  const seen = new Map<string, string>(); // lowercase key -> first-seen display casing

  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const key = exercise.exercise_name.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.set(key, exercise.exercise_name.trim());
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

export function getMaxWeightSeries(
  sessions: WorkoutSession[],
  exerciseName: string,
): { date: string; maxWeight: number }[] {
  const key = exerciseName.trim().toLowerCase();

  return sessions
    .map((session) => {
      const weights = session.exercises
        .filter((exercise) => exercise.exercise_name.trim().toLowerCase() === key)
        .flatMap((exercise) => exercise.sets.map((set) => set.weight));

      if (weights.length === 0) return null;

      return { date: session.session_date, maxWeight: Math.max(...weights) };
    })
    .filter((point): point is { date: string; maxWeight: number } => point !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}
