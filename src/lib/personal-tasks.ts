import { createClient } from "@/lib/supabase/server";

export type PersonalTask = {
  id: string;
  content: string;
  created_at: string;
};

export async function getPersonalTasks(): Promise<PersonalTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_tasks")
    .select("id, content, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load personal tasks:", error.message);
    return [];
  }

  return data ?? [];
}
