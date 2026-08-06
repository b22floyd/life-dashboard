import { getLocalDateString } from "@/lib/date-utils";
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

// Null means "failed to load" — distinct from an empty array (no cleaning
// tasks configured) so a Supabase outage doesn't masquerade as "all caught
// up for the week."
export async function getCleaningTasks(): Promise<CleaningTaskWithStatus[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cleaning_tasks")
    .select("id, name, frequency, created_at, cleaning_task_completions(completed_at)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load cleaning tasks:", error.message);
    return null;
  }

  // The server has no way to know the user's actual local timezone, so this
  // uses the server's own local date as a best-effort approximation — the
  // same tradeoff getDailyGlanceData's meal-plan lookup already accepts,
  // rare to matter outside a Sunday/Monday boundary. CleaningCardBody (the
  // card users actually interact with) recomputes this itself client-side
  // with the browser's real local date instead of trusting this value.
  const todayLocalDate = getLocalDateString();
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
      todayLocalDate,
    );
  });
}
