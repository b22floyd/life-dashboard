import { createClient } from "@/lib/supabase/server";
import { QUARTERS, type AnnualGoal, type Quarter } from "@/lib/goals-utils";

type RawGoal = {
  id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  goal_checkpoints:
    | {
        id: string;
        quarter: Quarter;
        target_description: string;
        completed: boolean;
        completed_at: string | null;
      }[]
    | null;
  goal_checkin_notes: { id: string; note: string; created_at: string }[] | null;
};

// Null means "failed to load" — distinct from an empty array (no goals set
// yet).
export async function getAnnualGoals(): Promise<AnnualGoal[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("annual_goals")
    .select(
      `id, title, description, position, created_at,
       goal_checkpoints (id, quarter, target_description, completed, completed_at),
       goal_checkin_notes (id, note, created_at)`,
    )
    .order("position", { ascending: true });

  if (error) {
    console.error("Failed to load annual goals:", error.message);
    return null;
  }

  return ((data ?? []) as RawGoal[]).map((goal) => {
    const checkpointsByQuarter = new Map(
      (goal.goal_checkpoints ?? []).map((checkpoint) => [checkpoint.quarter, checkpoint]),
    );

    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      position: goal.position,
      createdAt: goal.created_at,
      checkpoints: QUARTERS.map((quarter) => {
        const found = checkpointsByQuarter.get(quarter);
        return {
          id: found?.id ?? "",
          quarter,
          targetDescription: found?.target_description ?? "",
          completed: found?.completed ?? false,
          completedAt: found?.completed_at ?? null,
        };
      }),
      notes: (goal.goal_checkin_notes ?? [])
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((note) => ({ id: note.id, note: note.note, createdAt: note.created_at })),
    };
  });
}
