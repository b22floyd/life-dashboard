import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

// A plain fixed-window counter, one row per (user_id, action) in the
// rate_limits table. Not a sliding window or token bucket — this only needs
// to catch accidental spam (a double-clicked button, a retry loop from a
// bug) on a single-user, auth-gated app, not defend against a determined
// attacker, so the simplest thing that actually caps runaway paid-API calls
// is enough.
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("window_start, count")
    .eq("user_id", userId)
    .eq("action", action)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from("rate_limits")
      .insert({ user_id: userId, action, window_start: new Date(now).toISOString(), count: 1 });
    return { allowed: true };
  }

  const windowStart = new Date(existing.window_start).getTime();
  if (now - windowStart >= windowMs) {
    await supabase
      .from("rate_limits")
      .update({ window_start: new Date(now).toISOString(), count: 1 })
      .eq("user_id", userId)
      .eq("action", action);
    return { allowed: true };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((windowStart + windowMs - now) / 1000) };
  }

  await supabase
    .from("rate_limits")
    .update({ count: existing.count + 1 })
    .eq("user_id", userId)
    .eq("action", action);
  return { allowed: true };
}
