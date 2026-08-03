import { createClient } from "@/lib/supabase/server";
import {
  computeCleaningStatus,
  type CleaningFrequency,
  type CleaningTaskWithStatus,
} from "@/lib/cleaning-utils";

type CleaningTaskRow = {
  id: string;
  name: string;
  frequency: CleaningFrequency;
  created_at: string;
  cleaning_task_completions: { completed_at: string }[] | null;
};

export async function getCleaningTasks(): Promise<CleaningTaskWithStatus[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cleaning_tasks")
    .select("id, name, frequency, created_at, cleaning_task_completions(completed_at)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load cleaning tasks:", error.message);
    return [];
  }

  const now = new Date();
  return ((data ?? []) as CleaningTaskRow[]).map((row) => {
    const completions = row.cleaning_task_completions ?? [];
    const lastCompletedAt =
      completions.length === 0
        ? null
        : completions.reduce((latest, c) =>
            new Date(c.completed_at).getTime() > new Date(latest).getTime()
              ? c.completed_at
              : latest,
          completions[0].completed_at);

    return computeCleaningStatus(
      { id: row.id, name: row.name, frequency: row.frequency, createdAt: row.created_at },
      lastCompletedAt,
      now,
    );
  });
}
