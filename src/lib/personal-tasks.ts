import { createClient } from "@/lib/supabase/server";

export type PersonalTask = {
  id: string;
  content: string;
  created_at: string;
};

// Null means "failed to load" (a Supabase error), kept distinct from an
// empty array (genuinely no tasks) so the UI doesn't show a misleadingly
// cheerful "nothing to do" when the real story is a load failure.
export async function getPersonalTasks(): Promise<PersonalTask[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_tasks")
    .select("id, content, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load personal tasks:", error.message);
    return null;
  }

  return data ?? [];
}
