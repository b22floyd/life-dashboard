"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type JournalFormState = { error: string } | null;

export async function addJournalEntry(
  _prevState: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  const content = (formData.get("content") as string | null)?.trim();

  if (!content) {
    return { error: "Journal entry can't be empty." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("journal_entries").insert({
    content,
    entry_date: new Date().toISOString().slice(0, 10),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
}
