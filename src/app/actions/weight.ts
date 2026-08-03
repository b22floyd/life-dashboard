"use server";

import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/server";

export type AddWeightEntryState = { error: string } | null;

export async function addWeightEntry(
  _prevState: AddWeightEntryState,
  formData: FormData,
): Promise<AddWeightEntryState> {
  const weightRaw = formData.get("weight") as string | null;
  const entryDate = formData.get("entryDate") as string | null;

  const weight = Number(weightRaw);
  if (!weightRaw || Number.isNaN(weight) || weight <= 0) {
    return { error: "Enter a valid weight." };
  }
  if (!entryDate || !isValidDateString(entryDate)) {
    return { error: "Enter a valid date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to log your weight." };
  }

  // Logging again for a date that already has an entry overwrites it,
  // rather than creating a second entry for the same day.
  const { error } = await supabase
    .from("weight_entries")
    .upsert({ user_id: user.id, entry_date: entryDate, weight }, { onConflict: "user_id,entry_date" });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
}

export type WeightActionResult = { success: true } | { error: string };

export async function deleteWeightEntry(entryId: string): Promise<WeightActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to delete a weight entry." };
  }

  const { error } = await supabase
    .from("weight_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function updateWeightGoal(
  goalWeight: number,
  targetDate: string | null,
): Promise<WeightActionResult> {
  if (!Number.isFinite(goalWeight) || goalWeight <= 0) {
    return { error: "Enter a valid goal weight." };
  }
  if (targetDate && !isValidDateString(targetDate)) {
    return { error: "Enter a valid target date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to set a weight goal." };
  }

  const { error } = await supabase.from("weight_goal").upsert(
    {
      user_id: user.id,
      goal_weight: goalWeight,
      target_date: targetDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
