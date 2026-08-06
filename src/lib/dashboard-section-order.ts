import { createClient } from "@/lib/supabase/server";

export async function getSectionOrder(): Promise<string[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("dashboard_section_order")
    .select("section_order")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.section_order ?? null;
}
