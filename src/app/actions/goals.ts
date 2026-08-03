"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_ANNUAL_GOALS, QUARTERS, type Quarter } from "@/lib/goals-utils";

export type GoalActionResult = { success: true } | { error: string };
export type AddGoalState = { error: string } | null;

export async function addAnnualGoal(
  _prevState: AddGoalState,
  formData: FormData,
): Promise<AddGoalState> {
  const title = (formData.get("title") as string | null)?.trim();
  const description = ((formData.get("description") as string | null) ?? "").trim();

  if (!title) {
    return { error: "Enter a goal title before adding." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a goal." };
  }

  const { count, error: countError } = await supabase
    .from("annual_goals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return { error: countError.message };
  }
  if ((count ?? 0) >= MAX_ANNUAL_GOALS) {
    return { error: `You can only have up to ${MAX_ANNUAL_GOALS} annual goals at a time.` };
  }

  const { data: existing } = await supabase
    .from("annual_goals")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = existing ? existing.position + 1 : 0;

  const { data: goal, error } = await supabase
    .from("annual_goals")
    .insert({ title, description, position: nextPosition })
    .select("id")
    .single();

  if (error || !goal) {
    return { error: error?.message ?? "Failed to create goal." };
  }

  const { error: checkpointError } = await supabase.from("goal_checkpoints").insert(
    QUARTERS.map((quarter) => ({
      goal_id: goal.id,
      quarter,
      target_description: ((formData.get(`checkpoint_${quarter}`) as string | null) ?? "").trim(),
    })),
  );

  if (checkpointError) {
    return { error: checkpointError.message };
  }

  revalidatePath("/");
  return null;
}

export async function updateAnnualGoal(
  goalId: string,
  input: {
    title: string;
    description: string;
    checkpointDescriptions: Record<Quarter, string>;
  },
): Promise<GoalActionResult> {
  const title = input.title.trim();
  if (!title) {
    return { error: "Goal title can't be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update a goal." };
  }

  const { error: goalError } = await supabase
    .from("annual_goals")
    .update({ title, description: input.description.trim() })
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (goalError) {
    return { error: goalError.message };
  }

  for (const quarter of QUARTERS) {
    const { error } = await supabase
      .from("goal_checkpoints")
      .update({ target_description: input.checkpointDescriptions[quarter].trim() })
      .eq("goal_id", goalId)
      .eq("quarter", quarter);

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath("/");
  return { success: true };
}

export async function deleteAnnualGoal(goalId: string): Promise<GoalActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to delete a goal." };
  }

  const { error } = await supabase
    .from("annual_goals")
    .delete()
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function setCheckpointComplete(
  checkpointId: string,
  completed: boolean,
): Promise<GoalActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update a checkpoint." };
  }

  // goal_checkpoints has no user_id of its own — RLS scopes this update via
  // a join back to annual_goals. Selecting the row back after the update
  // tells us whether RLS actually let anything through, so a wrong-user
  // checkpoint id surfaces as a clear error instead of a silent no-op.
  const { data, error } = await supabase
    .from("goal_checkpoints")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", checkpointId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: "Checkpoint not found." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function addGoalCheckinNote(goalId: string, note: string): Promise<GoalActionResult> {
  const trimmed = note.trim();
  if (!trimmed) {
    return { error: "Enter a note before adding." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a check-in note." };
  }

  const { error } = await supabase
    .from("goal_checkin_notes")
    .insert({ goal_id: goalId, note: trimmed });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
