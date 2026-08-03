import { createClient } from "@/lib/supabase/server";
import { DAYS_OF_WEEK, type MealPlanEntry } from "@/lib/meal-plan-utils";

// Always returns exactly 7 entries (one per day of the week), filling in
// empty content for any day that doesn't have a row yet — new users (and
// anyone who's never filled in a given day) have no rows at all.
export async function getMealPlan(): Promise<MealPlanEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("day_of_week, content");

  if (error) {
    console.error("Failed to load meal plan:", error.message);
  }

  const byDay = new Map((data ?? []).map((row) => [row.day_of_week, row.content]));
  return DAYS_OF_WEEK.map((day) => ({ day_of_week: day, content: byDay.get(day) ?? "" }));
}
