import { createClient } from "@supabase/supabase-js";

// Service-role client for server-only, non-request-scoped work (the weekly
// backup cron has no signed-in session/cookies to read). This bypasses RLS
// entirely, so every caller must apply its own explicit ownership filters
// instead of relying on row security — see buildDataExport's user_id
// filters and the storage bucket's lack of anon/authenticated policies.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
