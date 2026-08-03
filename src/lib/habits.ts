import { createClient } from "@/lib/supabase/server";
import type { HabitWithCompletions } from "@/lib/habit-utils";

type RawHabit = {
  id: string;
  name: string;
  position: number;
  created_at: string;
  daily_habit_completions: { completed_date: string }[] | null;
};

export async function getHabits(): Promise<HabitWithCompletions[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("habits")
    .select("id, name, position, created_at, daily_habit_completions(completed_date)")
    .order("position", { ascending: true });

  if (error) {
    console.error("Failed to load habits:", error.message);
    return [];
  }

  return ((data ?? []) as RawHabit[]).map((habit) => ({
    id: habit.id,
    name: habit.name,
    position: habit.position,
    created_at: habit.created_at,
    completedDates: (habit.daily_habit_completions ?? []).map((c) => c.completed_date),
  }));
}
