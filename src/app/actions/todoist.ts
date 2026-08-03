"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { closeTodoistTask } from "@/lib/todoist";

export type SaveSelectionResult = { success: true } | { error: string };

export async function saveTodoistProjectSelection(
  projectIds: string[],
): Promise<SaveSelectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to save this preference." };
  }

  const { error } = await supabase.from("todoist_preferences").upsert(
    {
      user_id: user.id,
      selected_project_ids: projectIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export type CompleteTaskResult = { success: true } | { error: string };

export async function completeTodoistTask(taskId: string): Promise<CompleteTaskResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to complete a task." };
  }

  try {
    await closeTodoistTask(taskId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to complete task in Todoist.",
    };
  }

  revalidatePath("/");
  return { success: true };
}
