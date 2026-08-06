import { createClient } from "@/lib/supabase/server";
import type { HabitWithCompletions } from "@/lib/habit-utils";

type RawHabit = {
  id: string;
  name: string;
  position: number;
  created_at: string;
  daily_habit_completions: { completed_date: string }[] | null;
};

// Null specifically means "failed to load" (a Supabase error) — kept
// distinct from an empty array (no habits configured) so the UI can show a
// clear load-error message instead of a misleading "All habits done for
// today!" when the failure is what's actually empty-handed.
export async function getHabits(): Promise<HabitWithCompletions[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("habits")
    .select("id, name, position, created_at, daily_habit_completions(completed_date)")
    .order("position", { ascending: true });

  if (error) {
    console.error("Failed to load habits:", error.message);
    return null;
  }

  return ((data ?? []) as RawHabit[]).map((habit) => ({
    id: habit.id,
    name: habit.name,
    position: habit.position,
    created_at: habit.created_at,
    completedDates: (habit.daily_habit_completions ?? []).map((c) => c.completed_date),
  }));
}
