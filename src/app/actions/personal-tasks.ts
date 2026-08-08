"use server";

import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/server";

export type AddTaskState = { error: string } | null;

export async function addPersonalTask(
  _prevState: AddTaskState,
  formData: FormData,
): Promise<AddTaskState> {
  const content = (formData.get("content") as string | null)?.trim();
  if (!content) {
    return { error: "Enter a task before adding." };
  }

  // Optional — unlike Work Tasks, nothing external supplies a due date here,
  // so a task with none just means one hasn't been set yet.
  const dueDateInput = (formData.get("dueDate") as string | null)?.trim();
  if (dueDateInput && !isValidDateString(dueDateInput)) {
    return { error: "Invalid due date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a task." };
  }

  const { error } = await supabase
    .from("personal_tasks")
    .insert({ content, due_date: dueDateInput || null });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
}

export type UpdateDueDateResult = { success: true } | { error: string };

// Personal Tasks has no external sync — this is the only way a task's due
// date ever changes, whether setting one for the first time, changing it,
// or clearing it back to null (dueDate: null).
export async function updatePersonalTaskDueDate(
  taskId: string,
  dueDate: string | null,
): Promise<UpdateDueDateResult> {
  if (dueDate && !isValidDateString(dueDate)) {
    return { error: "Invalid due date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update a task." };
  }

  const { error } = await supabase
    .from("personal_tasks")
    .update({ due_date: dueDate })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export type CompleteTaskResult = { success: true } | { error: string };

export async function completePersonalTask(taskId: string): Promise<CompleteTaskResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to complete a task." };
  }

  const { error } = await supabase
    .from("personal_tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
