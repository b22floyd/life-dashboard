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

// Distinct exercise names exactly as stored, with how much history each one
// carries. Unlike getExerciseNames above (which folds case variants together
// for display), this keys on the exact trimmed string — "Bench Press" and
// "bench press" are genuinely separate rows in the database, and the merge
// UI needs to show them as separate, mergeable entries.
export type ExerciseUsage = { name: string; sessionCount: number; setCount: number };

export function getExerciseUsage(sessions: WorkoutSession[]): ExerciseUsage[] {
  const usage = new Map<string, ExerciseUsage>();

  for (const session of sessions) {
    const countedThisSession = new Set<string>();
    for (const exercise of session.exercises) {
      // Deliberately the raw stored string, not a trimmed copy: merging works
      // by matching exercise_name exactly, so a row saved as "Bench Press "
      // has to stay distinguishable from "Bench Press" here or the update
      // would silently skip it. Whitespace-only names are still ignored.
      const name = exercise.exercise_name;
      if (!name.trim()) continue;

      const entry = usage.get(name) ?? { name, sessionCount: 0, setCount: 0 };
      entry.setCount += exercise.sets.length;
      // A session that lists the same exercise twice still counts once.
      if (!countedThisSession.has(name)) {
        countedThisSession.add(name);
        entry.sessionCount += 1;
      }
      usage.set(name, entry);
    }
  }

  return Array.from(usage.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Equipment shorthand that routinely gets typed both ways. Only used to
// *suggest* merges — nothing is ever merged without confirmation.
const EXERCISE_ABBREVIATIONS: Record<string, string> = {
  bb: "barbell",
  db: "dumbbell",
  kb: "kettlebell",
  ohp: "overhead press",
  rdl: "romanian deadlift",
  sldl: "stiff leg deadlift",
  bw: "bodyweight",
  ez: "ezbar",
};

// Converges the common gym plurals: "presses"/"press", "curls"/"curl",
// "raises"/"raise" all reduce to the same stem, without mangling words that
// legitimately end in "ss".
function singularize(word: string): string {
  if (word.endsWith("es")) {
    const stem = word.slice(0, -2);
    if (stem.endsWith("ss")) return stem;
  }
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

// A loose key for spotting the same exercise typed differently: case,
// punctuation/hyphens, extra whitespace, equipment shorthand, plurals, and
// word order are all flattened. Word order is included so "Incline Bench
// Press" and "Bench Press Incline" match, while genuinely different lifts
// ("Bench Press" vs "Incline Bench Press") still keep distinct keys.
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => EXERCISE_ABBREVIATIONS[word] ?? word)
    .flatMap((word) => word.split(/\s+/))
    .map(singularize)
    .sort()
    .join(" ");
}

// Groups of distinct stored names that look like the same exercise. The
// suggested canonical name is whichever spelling has the most sets behind it
// (ties broken alphabetically) — the one most likely to be how the user
// actually wants it written.
export type MergeSuggestion = { canonical: string; names: string[] };

export function suggestExerciseMergeGroups(usage: ExerciseUsage[]): MergeSuggestion[] {
  const groups = new Map<string, ExerciseUsage[]>();

  for (const entry of usage) {
    const key = normalizeExerciseName(entry.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => {
      const canonical = group
        .slice()
        .sort((a, b) => b.setCount - a.setCount || a.name.localeCompare(b.name))[0].name;
      return { canonical, names: group.map((entry) => entry.name).sort((a, b) => a.localeCompare(b)) };
    })
    .sort((a, b) => a.canonical.localeCompare(b.canonical));
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

export type PersonalRecord = { exerciseName: string; oneRepMax: number; previousBest: number };

// Flags exercises in a just-logged session whose best set (by estimated
// 1RM, same "best set" definition as getOneRepMaxSeries) beats every prior
// session's best for that exercise. Only ever compares against *prior*
// sessions — never against other exercises within newSession itself — so
// this is safe to call with newSession already appended to the full history
// as much as with it kept separate.
//
// An exercise with no prior history at all is deliberately not a "record" —
// there's nothing yet to have beaten, and treating first-time logging as a
// PR would turn every brand-new exercise into a celebration, which cheapens
// the ones that actually mean something.
//
// If the same exercise appears more than once in newSession (a rare manual-
// entry slip, or two different variations someone typed the same name for),
// only the single best set across all of them is compared — never several
// separate "PR" results for one exercise from one session.
export function detectNewPersonalRecords(
  priorSessions: WorkoutSession[],
  newSession: WorkoutSession,
): PersonalRecord[] {
  const bestInSession = new Map<string, { displayName: string; oneRepMax: number }>();

  for (const exercise of newSession.exercises) {
    const key = exercise.exercise_name.trim().toLowerCase();
    if (!key) continue;

    const oneRepMaxes = exercise.sets.map((set) => estimateOneRepMax(set.weight, set.reps));
    if (oneRepMaxes.length === 0) continue;
    const best = Math.max(...oneRepMaxes);

    const existing = bestInSession.get(key);
    if (!existing || best > existing.oneRepMax) {
      bestInSession.set(key, { displayName: exercise.exercise_name.trim(), oneRepMax: best });
    }
  }

  const records: PersonalRecord[] = [];
  for (const { displayName, oneRepMax } of bestInSession.values()) {
    const priorSeries = getOneRepMaxSeries(priorSessions, displayName);
    if (priorSeries.length === 0) continue;

    const previousBest = Math.max(...priorSeries.map((point) => point.oneRepMax));
    if (oneRepMax > previousBest) {
      records.push({ exerciseName: displayName, oneRepMax, previousBest });
    }
  }

  return records.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
