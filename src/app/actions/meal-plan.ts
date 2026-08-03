"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DayOfWeek } from "@/lib/meal-plan-utils";

export type MealPlanActionResult = { success: true } | { error: string };

export async function updateMealPlanEntry(
  dayOfWeek: DayOfWeek,
  content: string,
): Promise<MealPlanActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update your meal plan." };
  }

  const { error } = await supabase.from("meal_plan_entries").upsert(
    {
      user_id: user.id,
      day_of_week: dayOfWeek,
      content: content.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,day_of_week" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
