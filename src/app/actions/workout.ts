"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { WORKOUT_CATEGORIES, type WorkoutCategory } from "@/lib/workout-utils";

const anthropic = new Anthropic();

// Generous enough for real use (nobody logs 20 workouts in an hour), tight
// enough to cap the cost of a retry loop or a double-clicked button
// hammering a paid API.
const PARSE_RATE_LIMIT = 20;
const PARSE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const ParsedSetSchema = z.object({
  weight: z
    .number()
    .describe("Weight used for this set, in pounds. 0 if bodyweight or not mentioned."),
  reps: z.number().int().describe("Number of reps performed in this set."),
});

const ParsedExerciseSchema = z.object({
  name: z.string().describe("Name of the exercise, e.g. 'Bench Press'."),
  sets: z.array(ParsedSetSchema),
});

const ParsedWorkoutSchema = z.object({
  name: z
    .string()
    .nullable()
    .describe("A short name for the session if one was mentioned (e.g. 'Push Day'), else null."),
  exercises: z.array(ParsedExerciseSchema),
});

export type ParsedWorkout = z.infer<typeof ParsedWorkoutSchema>;
export type ParseWorkoutState = { data: ParsedWorkout } | { error: string } | null;

export async function parseWorkoutText(
  _prevState: ParseWorkoutState,
  formData: FormData,
): Promise<ParseWorkoutState> {
  const text = (formData.get("description") as string | null)?.trim();
  if (!text) {
    return { error: "Describe your workout before parsing." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to parse a workout." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "Workout parsing isn't configured (missing ANTHROPIC_API_KEY)." };
  }

  const rateLimit = await checkRateLimit(supabase, user.id, "parseWorkoutText", PARSE_RATE_LIMIT, PARSE_RATE_LIMIT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return {
      error: `Too many parse requests — try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  try {
    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2048,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ParsedWorkoutSchema),
      },
      messages: [
        {
          role: "user",
          content:
            "Extract structured strength-training data from this workout description. " +
            'Expand repeated sets (e.g. "three sets of 135 for 10") into that many individual ' +
            "set entries. If a set's weight isn't mentioned (bodyweight exercise), use 0.\n\n" +
            `Workout description:\n${text}`,
        },
      ],
    });

    if (!response.parsed_output) {
      return { error: "Couldn't parse that workout — try rephrasing or enter it manually." };
    }

    return { data: response.parsed_output };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to parse workout.",
    };
  }
}

export type WorkoutPayload = {
  name: string | null;
  category: WorkoutCategory | null;
  sessionDate: string;
  exercises: { name: string; sets: { weight: number; reps: number }[] }[];
};

export type SaveWorkoutState = { success: true } | { error: string };

export async function saveWorkoutSession(
  payload: WorkoutPayload,
): Promise<SaveWorkoutState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to save a workout." };
  }

  if (!payload.category) {
    return { error: "Select a category before saving." };
  }

  if (!WORKOUT_CATEGORIES.includes(payload.category)) {
    return { error: "Invalid category." };
  }

  const exercises = payload.exercises.filter(
    (exercise) => exercise.name.trim() && exercise.sets.length > 0,
  );

  if (exercises.length === 0) {
    return { error: "Add at least one exercise with a set before saving." };
  }

  // The client sends its own local date (WorkoutCard computes this at save
  // time) — computing it here instead would use the server's (UTC) date,
  // stamping late-evening sessions with tomorrow's date. Only falls back to
  // the server's date if the field is somehow missing/malformed.
  const sessionDate = isValidDateString(payload.sessionDate)
    ? payload.sessionDate
    : new Date().toISOString().slice(0, 10);

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      session_date: sessionDate,
      name: payload.name?.trim() || null,
      category: payload.category,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    return { error: sessionError?.message ?? "Failed to create workout session." };
  }

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from("session_exercises")
    .insert(
      exercises.map((exercise, index) => ({
        session_id: session.id,
        exercise_name: exercise.name.trim(),
        position: index,
      })),
    )
    .select("id");

  if (exerciseError || !exerciseRows) {
    return { error: exerciseError?.message ?? "Failed to save exercises." };
  }

  const setsToInsert = exercises.flatMap((exercise, index) =>
    exercise.sets.map((set, setIndex) => ({
      session_exercise_id: exerciseRows[index].id,
      set_number: setIndex + 1,
      weight: set.weight,
      reps: set.reps,
    })),
  );

  const { error: setsError } = await supabase.from("exercise_sets").insert(setsToInsert);

  if (setsError) {
    return { error: setsError.message };
  }

  revalidatePath("/");
  return { success: true };
}

export type MergeExercisesResult = { success: true; updatedCount: number } | { error: string };

// Renames every matching session_exercises row to a single canonical name.
// Because exercise_name is free text that both the progress chart and the
// history list read directly, renaming *is* the merge — the historical sets
// stay attached to their sessions and simply start reporting under one name.
export async function mergeExercises(
  names: string[],
  canonicalName: string,
): Promise<MergeExercisesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to merge exercises." };
  }

  const canonical = canonicalName.trim();
  if (!canonical) {
    return { error: "Enter a name to merge into." };
  }

  // The names arrive as the exact strings stored in the database (see
  // getExerciseUsage), so an exact-match .in() is what actually catches
  // every variant — including ones differing only by case or whitespace.
  // Dropping the canonical name itself would be wrong: a row already
  // spelled that way needs no change, but leaving it in keeps the count
  // honest and costs nothing.
  const targets = names.filter((name) => name.trim());
  if (targets.length === 0) {
    return { error: "Select at least one exercise to merge." };
  }

  // Scoping is enforced by RLS — the "Users can update their own session
  // exercises" policy joins back to workout_sessions and checks user_id —
  // the same way inserts here rely on their with-check policy. There's no
  // user_id column on session_exercises to filter on directly.
  const { data, error } = await supabase
    .from("session_exercises")
    .update({ exercise_name: canonical })
    .in("exercise_name", targets)
    .select("id");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true, updatedCount: data?.length ?? 0 };
}

export type DeleteSessionResult = { success: true } | { error: string };

export async function deleteWorkoutSession(sessionId: string): Promise<DeleteSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to delete a workout session." };
  }

  // Cascades to session_exercises and exercise_sets via their foreign keys.
  const { error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
