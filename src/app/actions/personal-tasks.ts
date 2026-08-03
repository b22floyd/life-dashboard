"use server";

import { revalidatePath } from "next/cache";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a task." };
  }

  const { error } = await supabase.from("personal_tasks").insert({ content });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
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
