import { createClient } from "@/lib/supabase/server";
import type { WeightEntry, WeightGoal } from "@/lib/weight-utils";

// Null means "failed to load" — distinct from an empty array (no entries
// logged yet).
export async function getWeightEntries(): Promise<WeightEntry[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weight_entries")
    .select("id, entry_date, weight")
    .order("entry_date", { ascending: true });

  if (error) {
    console.error("Failed to load weight entries:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    entryDate: row.entry_date,
    weight: row.weight,
  }));
}

export async function getWeightGoal(): Promise<WeightGoal> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weight_goal")
    .select("goal_weight, target_date")
    .maybeSingle();

  if (error) {
    console.error("Failed to load weight goal:", error.message);
    return null;
  }
  if (!data) {
    return null;
  }

  return { goalWeight: data.goal_weight, targetDate: data.target_date };
}
