import { createClient } from "@/lib/supabase/server";

export type JournalEntry = {
  id: string;
  entry_date: string;
  content: string;
  created_at: string;
};

// Null means "failed to load" — distinct from an empty array (no entries
// written yet).
export async function getJournalEntries(): Promise<JournalEntry[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, entry_date, content, created_at")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load journal entries:", error.message);
    return null;
  }

  return data ?? [];
}
