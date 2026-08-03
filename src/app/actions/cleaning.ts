"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLEANING_FREQUENCIES, type CleaningFrequency } from "@/lib/cleaning-utils";

export type CleaningActionResult = { success: true } | { error: string };
export type AddCleaningTaskState = { error: string } | null;

export async function addCleaningTask(
  _prevState: AddCleaningTaskState,
  formData: FormData,
): Promise<AddCleaningTaskState> {
  const name = (formData.get("name") as string | null)?.trim();
  const frequency = formData.get("frequency") as string | null;

  if (!name) {
    return { error: "Enter a task name before adding." };
  }
  if (!frequency || !CLEANING_FREQUENCIES.includes(frequency as CleaningFrequency)) {
    return { error: "Select a frequency before adding." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a cleaning task." };
  }

  const { error } = await supabase.from("cleaning_tasks").insert({ name, frequency });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
}

export async function renameCleaningTask(
  taskId: string,
  name: string,
): Promise<CleaningActionResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Task name can't be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to rename a cleaning task." };
  }

  const { error } = await supabase
    .from("cleaning_tasks")
    .update({ name: trimmed })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function updateCleaningTaskFrequency(
  taskId: string,
  frequency: CleaningFrequency,
): Promise<CleaningActionResult> {
  if (!CLEANING_FREQUENCIES.includes(frequency)) {
    return { error: "Invalid frequency." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update a cleaning task." };
  }

  const { error } = await supabase
    .from("cleaning_tasks")
    .update({ frequency })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function deleteCleaningTask(taskId: string): Promise<CleaningActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to delete a cleaning task." };
  }

  const { error } = await supabase
    .from("cleaning_tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// Marking a task done logs a new completion event; unchecking removes the
// most recent one instead (an undo for an accidental check) — there's no
// mutable "last done" flag to just flip, since cleaning_task_completions is
// an append-only log.
export async function setCleaningTaskCompletion(
  taskId: string,
  completed: boolean,
): Promise<CleaningActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update a cleaning task." };
  }

  // cleaning_task_completions has no user_id of its own (ownership is
  // checked via RLS joining back to cleaning_tasks), so confirm the task
  // belongs to this user before touching its completions.
  const { data: task, error: taskError } = await supabase
    .from("cleaning_tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (taskError) {
    return { error: taskError.message };
  }
  if (!task) {
    return { error: "Cleaning task not found." };
  }

  if (completed) {
    const { error } = await supabase
      .from("cleaning_task_completions")
      .insert({ task_id: taskId });
    if (error) {
      return { error: error.message };
    }
  } else {
    const { data: latest, error: latestError } = await supabase
      .from("cleaning_task_completions")
      .select("id")
      .eq("task_id", taskId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      return { error: latestError.message };
    }
    if (!latest) {
      return { success: true };
    }

    const { error } = await supabase
      .from("cleaning_task_completions")
      .delete()
      .eq("id", latest.id);
    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath("/");
  return { success: true };
}
