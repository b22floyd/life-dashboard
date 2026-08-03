"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WORKOUT_CATEGORIES, type WorkoutCategory } from "@/lib/workout-utils";

const anthropic = new Anthropic();

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

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      session_date: new Date().toISOString().slice(0, 10),
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
