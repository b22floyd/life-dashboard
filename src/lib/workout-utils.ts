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

// Epley formula: estimated 1-rep max from a single set's weight and reps.
export function estimateOneRepMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function getOneRepMaxSeries(
  sessions: WorkoutSession[],
  exerciseName: string,
): { date: string; oneRepMax: number }[] {
  const key = exerciseName.trim().toLowerCase();

  return sessions
    .map((session) => {
      const oneRepMaxes = session.exercises
        .filter((exercise) => exercise.exercise_name.trim().toLowerCase() === key)
        .flatMap((exercise) =>
          exercise.sets.map((set) => estimateOneRepMax(set.weight, set.reps)),
        );

      if (oneRepMaxes.length === 0) return null;

      // "Best set" is whichever set produces the highest estimated 1RM, not
      // necessarily the heaviest weight or the most reps.
      return { date: session.session_date, oneRepMax: Math.max(...oneRepMaxes) };
    })
    .filter((point): point is { date: string; oneRepMax: number } => point !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}
