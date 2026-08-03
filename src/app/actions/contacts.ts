"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CONTACT_CATEGORIES, type ContactCategory } from "@/lib/contacts-utils";

export type ContactActionResult = { success: true } | { error: string };
export type AddContactState = { error: string } | null;

export async function addContact(
  _prevState: AddContactState,
  formData: FormData,
): Promise<AddContactState> {
  const name = (formData.get("name") as string | null)?.trim();
  const category = formData.get("category") as string | null;
  const cadenceRaw = formData.get("cadenceDays") as string | null;
  const birthday = (formData.get("birthday") as string | null) || null;
  const importantDate = (formData.get("importantDate") as string | null) || null;
  const importantDateLabel = ((formData.get("importantDateLabel") as string | null) ?? "").trim();
  const notes = ((formData.get("notes") as string | null) ?? "").trim();
  const giftIdeas = ((formData.get("giftIdeas") as string | null) ?? "").trim();

  if (!name) {
    return { error: "Enter a name before adding." };
  }
  if (!category || !CONTACT_CATEGORIES.includes(category as ContactCategory)) {
    return { error: "Select a category before adding." };
  }

  const cadenceDays = Number(cadenceRaw);
  if (!cadenceRaw || Number.isNaN(cadenceDays) || cadenceDays <= 0) {
    return { error: "Enter a valid reach-out cadence (in days)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to add a contact." };
  }

  const { error } = await supabase.from("contacts").insert({
    name,
    category,
    birthday,
    important_date: importantDate,
    important_date_label: importantDateLabel,
    notes,
    gift_ideas: giftIdeas,
    cadence_days: cadenceDays,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return null;
}

export async function updateContact(
  contactId: string,
  input: {
    name: string;
    category: ContactCategory;
    birthday: string | null;
    importantDate: string | null;
    importantDateLabel: string;
    notes: string;
    giftIdeas: string;
    cadenceDays: number;
  },
): Promise<ContactActionResult> {
  const name = input.name.trim();
  if (!name) {
    return { error: "Name can't be empty." };
  }
  if (!CONTACT_CATEGORIES.includes(input.category)) {
    return { error: "Invalid category." };
  }
  if (!Number.isFinite(input.cadenceDays) || input.cadenceDays <= 0) {
    return { error: "Enter a valid reach-out cadence (in days)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to update a contact." };
  }

  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      category: input.category,
      birthday: input.birthday,
      important_date: input.importantDate,
      important_date_label: input.importantDateLabel.trim(),
      notes: input.notes.trim(),
      gift_ideas: input.giftIdeas.trim(),
      cadence_days: input.cadenceDays,
    })
    .eq("id", contactId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function deleteContact(contactId: string): Promise<ContactActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to delete a contact." };
  }

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

// Records "reached out today" — an append-only log, not a mutable flag,
// same shape as Routine Cleaning Reminders' completions.
export async function logContact(contactId: string): Promise<ContactActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to log a contact." };
  }

  // contact_log has no user_id of its own — confirm the contact belongs to
  // this user before inserting, same defensive check as setCleaningTaskCompletion.
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (contactError) {
    return { error: contactError.message };
  }
  if (!contact) {
    return { error: "Contact not found." };
  }

  const { error } = await supabase.from("contact_log").insert({ contact_id: contactId });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
