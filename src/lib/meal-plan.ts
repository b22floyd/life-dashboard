import { createClient } from "@/lib/supabase/server";
import {
  DAYS_OF_WEEK,
  MEAL_SLOTS,
  type DayOfWeek,
  type MealMode,
  type MealPlanEntry,
  type MealSlot,
} from "@/lib/meal-plan-utils";

type MealPlanRow = {
  day_of_week: DayOfWeek;
  meal_slot: MealSlot;
  mode: MealMode;
  content: string;
  leftover_day_of_week: DayOfWeek | null;
  leftover_meal_slot: MealSlot | null;
};

// Always returns exactly 21 entries (7 days × Breakfast/Lunch/Dinner),
// filling in defaults for any slot that doesn't have a row yet for this
// particular week — a brand-new week (or a brand-new account) has none at all.
// Null means "failed to load" instead — a Supabase error used to fall
// through to this same all-blank-slots shape, indistinguishable from a
// genuinely empty new week.
export async function getMealPlanForWeek(weekStartDate: string): Promise<MealPlanEntry[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("day_of_week, meal_slot, mode, content, leftover_day_of_week, leftover_meal_slot")
    .eq("week_start_date", weekStartDate);

  if (error) {
    console.error("Failed to load meal plan:", error.message);
    return null;
  }

  const byKey = new Map(
    ((data ?? []) as MealPlanRow[]).map((row) => [`${row.day_of_week}-${row.meal_slot}`, row]),
  );

  const entries: MealPlanEntry[] = [];
  for (const day of DAYS_OF_WEEK) {
    for (const slot of MEAL_SLOTS) {
      const row = byKey.get(`${day}-${slot}`);
      entries.push({
        weekStartDate,
        dayOfWeek: day,
        mealSlot: slot,
        mode: row?.mode ?? "custom",
        content: row?.content ?? "",
        leftoverDayOfWeek: row?.leftover_day_of_week ?? null,
        leftoverMealSlot: row?.leftover_meal_slot ?? null,
      });
    }
  }
  return entries;
}
