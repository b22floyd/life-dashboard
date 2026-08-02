"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revokeGoogleToken } from "@/lib/google-calendar";

export async function disconnectGoogleCalendar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connection) {
    await revokeGoogleToken(connection.access_token);
  }

  await supabase.from("google_calendar_connections").delete().eq("user_id", user.id);

  revalidatePath("/");
}
