import { createClient } from "@/lib/supabase/server";
import type { HealthSnapshot, RecoveryPoint } from "@/lib/whoop-utils";

const TOKEN_ENDPOINT = "https://api.prod.whoop.com/oauth/oauth2/token";
// Whoop fully sunset the v1 data API in October 2025 — the OAuth token
// endpoint above is unversioned and unaffected, but every /developer/v1/*
// data call (cycle, recovery, activity/sleep) now 404s. v2 keeps the same
// paths and response field names, so this is the only change needed.
const API_BASE = "https://api.prod.whoop.com/developer/v2";

export async function isWhoopConnected(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("whoop_connections")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return Boolean(data);
}

// Whoop's token endpoint returns a JSON body like
// {"error": "invalid_grant", "error_description": "..."} on failure. Falls
// back to the raw response text if it isn't JSON. Mirrors the identical
// helper in the OAuth callback route — small enough that duplicating it
// beats introducing a cross-cutting shared module for one function.
async function describeErrorResponse(response: Response): Promise<string> {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as { error?: string; error_description?: string };
    if (parsed.error) {
      return parsed.error_description ? `${parsed.error}: ${parsed.error_description}` : parsed.error;
    }
  } catch {
    // Not JSON — fall through to the raw text below.
  }
  return raw.slice(0, 300);
}

// Thrown with the HTTP status attached so callers can tell a definitive
// rejection (400 invalid_grant — the refresh token itself is dead) apart
// from a transient failure (5xx, network hiccup) worth just retrying later.
class WhoopTokenRefreshError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(`Whoop token refresh failed (${status}): ${detail}`);
    this.status = status;
  }
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const detail = await describeErrorResponse(response);
    throw new WhoopTokenRefreshError(response.status, detail);
  }

  // Whoop rotates refresh tokens on every use — the one just spent is
  // invalidated the instant this response is issued, and a new one comes
  // back in its place. refresh_token is typed optional defensively, but a
  // missing one here would mean every subsequent refresh fails outright.
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

// Returns a valid access token for the current user, refreshing and
// persisting it first if it's expired or about to expire. Null if there's
// no stored connection (or refreshing it failed).
async function getValidAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: connection } = await supabase
    .from("whoop_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) return null;

  const expiresInMs = new Date(connection.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) {
    return connection.access_token;
  }

  try {
    const refreshed = await refreshAccessToken(connection.refresh_token);
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("whoop_connections")
      .update({
        access_token: refreshed.access_token,
        // The bug this fixes: Whoop issues a new refresh_token alongside the
        // new access_token and invalidates the old one immediately. Not
        // persisting it here meant the very next refresh attempt reused a
        // refresh token Whoop had already rotated away, failed with
        // invalid_grant, and forced a manual reconnect — every time, after
        // the first automatic refresh ever since the connection was made.
        refresh_token: refreshed.refresh_token ?? connection.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Refreshed Whoop token but failed to persist it:", updateError.message);
    }

    return refreshed.access_token;
  } catch (error) {
    console.error(
      "Failed to refresh Whoop token:",
      error instanceof Error ? error.message : error,
    );

    // A 400 (invalid_grant) means the refresh token itself is dead — expired,
    // revoked on Whoop's side, or already rotated past — not something a
    // retry will fix. Delete the stale connection so the dashboard shows
    // "Connect Whoop" again instead of a confusing "couldn't load data"
    // message while still claiming to be connected. A 5xx or network error
    // is left alone, since that's worth just trying again on the next load.
    if (error instanceof WhoopTokenRefreshError && error.status === 400) {
      await supabase.from("whoop_connections").delete().eq("user_id", user.id);
    }

    return null;
  }
}

type WhoopCollection<T> = { records: T[]; next_token: string | null };

type WhoopCycle = {
  start: string;
  score_state: string;
  score?: { strain: number };
};

type WhoopRecovery = {
  created_at: string;
  score_state: string;
  score?: { recovery_score: number; resting_heart_rate: number; hrv_rmssd_milli: number };
};

type WhoopSleep = {
  start: string;
  score_state: string;
  score?: {
    stage_summary?: {
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
    };
    sleep_performance_percentage?: number;
  };
};

async function whoopFetch<T>(
  path: string,
  accessToken: string,
  params: Record<string, string>,
): Promise<T | null> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (error) {
    console.error(`Failed to reach Whoop (${path}):`, error);
    return null;
  }

  if (!response.ok) {
    console.error(`Whoop API error on ${path}:`, response.status);
    return null;
  }

  return (await response.json()) as T;
}

// "auth_error" means we never had a usable access token (no connection, or
// the refresh itself failed) — reconnecting is the right advice. "api_error"
// means the token was valid but Whoop's API rejected/failed the request
// anyway (e.g. a wrong/retired endpoint, or a Whoop-side outage) — telling
// the user to reconnect would be misleading, since their connection is fine.
export type HealthSnapshotResult =
  | { snapshot: HealthSnapshot }
  | { snapshot: null; reason: "auth_error" | "api_error" };

export async function getHealthSnapshot(): Promise<HealthSnapshotResult> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return { snapshot: null, reason: "auth_error" };

  const [cycles, recoveries, sleeps] = await Promise.all([
    whoopFetch<WhoopCollection<WhoopCycle>>("/cycle", accessToken, { limit: "1" }),
    whoopFetch<WhoopCollection<WhoopRecovery>>("/recovery", accessToken, { limit: "1" }),
    whoopFetch<WhoopCollection<WhoopSleep>>("/activity/sleep", accessToken, { limit: "1" }),
  ]);

  const cycle = cycles?.records[0];
  const recovery = recoveries?.records[0];
  const sleep = sleeps?.records[0];

  // All three requests failed outright (as opposed to a given record simply
  // not being scored yet) — treat this like "couldn't load".
  if (cycles === null && recoveries === null && sleeps === null) {
    return { snapshot: null, reason: "api_error" };
  }

  const stages = sleep?.score_state === "SCORED" ? sleep.score?.stage_summary : undefined;
  const sleepDurationMs = stages
    ? stages.total_light_sleep_time_milli +
      stages.total_slow_wave_sleep_time_milli +
      stages.total_rem_sleep_time_milli
    : null;

  const recoveryScored = recovery?.score_state === "SCORED" ? recovery.score : undefined;
  const cycleScored = cycle?.score_state === "SCORED" ? cycle.score : undefined;

  return {
    snapshot: {
      recoveryScore: recoveryScored ? Math.round(recoveryScored.recovery_score) : null,
      restingHeartRate: recoveryScored?.resting_heart_rate ?? null,
      hrvMilli: recoveryScored?.hrv_rmssd_milli ?? null,
      sleepDurationMs,
      sleepPerformancePercentage:
        sleep?.score_state === "SCORED" ? sleep.score?.sleep_performance_percentage ?? null : null,
      strain: cycleScored ? cycleScored.strain : null,
      asOf: recovery?.created_at ?? cycle?.start ?? sleep?.start ?? new Date().toISOString(),
    },
  };
}

// Empty array (rather than null) on failure — the trend chart already
// renders a friendly "no data" state for zero points. Returns raw ISO
// timestamps rather than pre-bucketing into calendar days here — this runs
// server-side and has no idea what the user's local timezone is, so slicing
// `created_at` into a "yyyy-mm-dd" date here would bucket some points onto
// the wrong day. The chart buckets/formats them client-side instead.
export async function getRecoveryTrend(days = 7): Promise<RecoveryPoint[]> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return [];

  const data = await whoopFetch<WhoopCollection<WhoopRecovery>>("/recovery", accessToken, {
    limit: String(days),
  });

  return (data?.records ?? [])
    .filter((record) => record.score_state === "SCORED" && record.score)
    .map((record) => ({
      timestamp: record.created_at,
      recoveryScore: Math.round(record.score!.recovery_score),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
