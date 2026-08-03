"use server";

import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/date-utils";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to save journal entries." };
  }

  // The client sends its own local date (JournalCard sets this right at
  // submit time) — computing it here instead would use the server's (UTC)
  // date, stamping late-evening entries with tomorrow's date. Only falls
  // back to the server's date if the field is somehow missing/malformed.
  const entryDateInput = formData.get("entryDate") as string | null;
  const entryDate =
    entryDateInput && isValidDateString(entryDateInput)
      ? entryDateInput
      : new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("journal_entries").insert({
    content,
    entry_date: entryDate,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
}

export type DeleteEntryResult = { success: true } | { error: string };

export async function deleteJournalEntry(entryId: string): Promise<DeleteEntryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to delete a journal entry." };
  }

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
