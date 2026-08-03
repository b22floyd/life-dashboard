"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Whoop's public API has no documented token-revocation endpoint (unlike
// Google's /revoke) — disconnecting just deletes the stored tokens.
export async function disconnectWhoop() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("whoop_connections").delete().eq("user_id", user.id);

  revalidatePath("/");
}
