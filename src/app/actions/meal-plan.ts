"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getMealPlanForWeek } from "@/lib/meal-plan";
import {
  MEAL_MODES,
  getPreviousWeekStartDate,
  type DayOfWeek,
  type MealMode,
  type MealPlanEntry,
  type MealSlot,
} from "@/lib/meal-plan-utils";

const anthropic = new Anthropic();

// Generous enough for real use (nobody parses ingredients for 20 meals in
// an hour), tight enough to cap the cost of a retry loop or a
// double-clicked button hammering a paid API.
const PARSE_INGREDIENTS_RATE_LIMIT = 20;
const PARSE_INGREDIENTS_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export type MealPlanActionResult = { success: true } | { error: string };
export type MealPlanFetchResult = { entries: MealPlanEntry[] } | { error: string };

// A plain callable (not a form action). MealPlanGroceryCard renders an
// initial guess at the current week using the server's (UTC) clock; if the
// browser's actual local week differs, MealPlanSection calls this once on
// mount to re-fetch the correct week (see Timezones).
export async function fetchMealPlanForWeek(weekStartDate: string): Promise<MealPlanFetchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to view your meal plan." };
  }

  const entries = await getMealPlanForWeek(weekStartDate);
  if (entries === null) {
    return { error: "Couldn't load this week's meal plan. Try again shortly." };
  }
  return { entries };
}

export async function updateMealPlanEntry(input: {
  weekStartDate: string;
  dayOfWeek: DayOfWeek;
  mealSlot: MealSlot;
  mode: MealMode;
  content: string;
  leftoverDayOfWeek: DayOfWeek | null;
  leftoverMealSlot: MealSlot | null;
}): Promise<MealPlanActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update your meal plan." };
  }

  if (!MEAL_MODES.includes(input.mode)) {
    return { error: "Invalid meal mode." };
  }

  const { error } = await supabase.from("meal_plan_entries").upsert(
    {
      user_id: user.id,
      week_start_date: input.weekStartDate,
      day_of_week: input.dayOfWeek,
      meal_slot: input.mealSlot,
      mode: input.mode,
      content: input.mode === "custom" ? input.content.trim() : "",
      leftover_day_of_week: input.mode === "leftovers" ? input.leftoverDayOfWeek : null,
      leftover_meal_slot: input.mode === "leftovers" ? input.leftoverMealSlot : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start_date,day_of_week,meal_slot" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// Duplicates last week's full plan (mode + content + leftover references)
// into the current week as a starting point — only copies slots that
// actually had something set, so an empty previous week doesn't clobber
// the current week with 21 blank rows.
export async function copyPreviousWeek(weekStartDate: string): Promise<MealPlanFetchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to copy your meal plan." };
  }

  const previousWeekStartDate = getPreviousWeekStartDate(weekStartDate);
  const previousEntries = await getMealPlanForWeek(previousWeekStartDate);
  if (previousEntries === null) {
    return { error: "Couldn't load last week's meal plan. Try again shortly." };
  }
  const filledEntries = previousEntries.filter(
    (entry) => entry.mode !== "custom" || entry.content.trim() !== "",
  );

  if (filledEntries.length === 0) {
    return { error: "Last week's plan is empty — nothing to copy." };
  }

  const { error } = await supabase.from("meal_plan_entries").upsert(
    filledEntries.map((entry) => ({
      user_id: user.id,
      week_start_date: weekStartDate,
      day_of_week: entry.dayOfWeek,
      meal_slot: entry.mealSlot,
      mode: entry.mode,
      content: entry.content,
      leftover_day_of_week: entry.leftoverDayOfWeek,
      leftover_meal_slot: entry.leftoverMealSlot,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,week_start_date,day_of_week,meal_slot" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  const entries = await getMealPlanForWeek(weekStartDate);
  if (entries === null) {
    return { error: "Copied last week's plan, but couldn't reload this week to show it. Refresh to see it." };
  }
  return { entries };
}

const ParsedIngredientsSchema = z.object({
  ingredients: z
    .array(z.string())
    .describe(
      "Likely grocery items needed to make this meal, each a short shopping-list-style entry (e.g. 'ground beef', 'taco shells'), skipping common pantry staples like salt, pepper, or water.",
    ),
});

export type ParseMealIngredientsResult = { data: string[] } | { error: string };

export async function parseMealIngredients(
  mealDescription: string,
): Promise<ParseMealIngredientsResult> {
  const text = mealDescription.trim();
  if (!text) {
    return { error: "Enter a meal before adding ingredients." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to parse ingredients." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "Ingredient parsing isn't configured (missing ANTHROPIC_API_KEY)." };
  }

  const rateLimit = await checkRateLimit(
    supabase,
    user.id,
    "parseMealIngredients",
    PARSE_INGREDIENTS_RATE_LIMIT,
    PARSE_INGREDIENTS_RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    return {
      error: `Too many parse requests — try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  try {
    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ParsedIngredientsSchema),
      },
      messages: [
        {
          role: "user",
          content:
            "List the likely grocery items needed to make this meal, as a short shopping list. " +
            "Keep each item brief (e.g. 'ground beef', not a full sentence).\n\n" +
            `Meal: ${text}`,
        },
      ],
    });

    if (!response.parsed_output) {
      return { error: "Couldn't figure out ingredients for that meal — try adding more detail." };
    }

    return { data: response.parsed_output.ingredients };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to parse ingredients.",
    };
  }
}
