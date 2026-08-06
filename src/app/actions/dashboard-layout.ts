"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveSectionOrderResult = { success: true } | { error: string };

export async function saveSectionOrder(order: string[]): Promise<SaveSectionOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to save dashboard layout preferences." };
  }

  const { error } = await supabase.from("dashboard_section_order").upsert(
    {
      user_id: user.id,
      section_order: order,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: error.message };
  }

  // Deliberately no revalidatePath here, unlike this app's other server
  // actions — the new order is already fully reflected in the client's own
  // state (that's what the user just dragged into place), and revalidating
  // would force every other Suspense-wrapped card to refetch its data
  // (including external API calls like Todoist/Whoop/Google Calendar) for a
  // change that has no server-rendered output of its own to catch up on.
  return { success: true };
}
