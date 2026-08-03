"use server";

import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/server";

export type AddHabitState = { error: string } | null;

export async function addHabit(
  _prevState: AddHabitState,
  formData: FormData,
): Promise<AddHabitState> {
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) {
    return { error: "Enter a habit name before adding." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a habit." };
  }

  const { data: existing } = await supabase
    .from("habits")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = existing ? existing.position + 1 : 0;

  const { error } = await supabase
    .from("habits")
    .insert({ name, position: nextPosition });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
}

export type HabitActionResult = { success: true } | { error: string };

export async function renameHabit(habitId: string, name: string): Promise<HabitActionResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Habit name can't be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to rename a habit." };
  }

  const { error } = await supabase
    .from("habits")
    .update({ name: trimmed })
    .eq("id", habitId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function deleteHabit(habitId: string): Promise<HabitActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to delete a habit." };
  }

  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// Swaps position with the immediate neighbor rather than accepting a full
// reordered list — the UI only ever moves one habit up or down a single
// step at a time.
export async function reorderHabit(
  habitId: string,
  direction: "up" | "down",
): Promise<HabitActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to reorder habits." };
  }

  const { data: habits, error } = await supabase
    .from("habits")
    .select("id, position")
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  if (error || !habits) {
    return { error: error?.message ?? "Failed to load habits." };
  }

  const index = habits.findIndex((h) => h.id === habitId);
  if (index === -1) {
    return { error: "Habit not found." };
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= habits.length) {
    return { success: true }; // already at the top/bottom — nothing to do
  }

  const current = habits[index];
  const swapWith = habits[swapIndex];

  const { error: error1 } = await supabase
    .from("habits")
    .update({ position: swapWith.position })
    .eq("id", current.id);
  if (error1) return { error: error1.message };

  const { error: error2 } = await supabase
    .from("habits")
    .update({ position: current.position })
    .eq("id", swapWith.id);
  if (error2) return { error: error2.message };

  revalidatePath("/");
  return { success: true };
}

export async function setHabitCompletion(
  habitId: string,
  date: string,
  completed: boolean,
): Promise<HabitActionResult> {
  if (!isValidDateString(date)) {
    return { error: "Invalid date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update a habit." };
  }

  if (completed) {
    const { error } = await supabase
      .from("daily_habit_completions")
      .upsert(
        { habit_id: habitId, completed_date: date },
        { onConflict: "habit_id,completed_date" },
      );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("daily_habit_completions")
      .delete()
      .eq("habit_id", habitId)
      .eq("completed_date", date);
    if (error) return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
