import { createClient } from "@/lib/supabase/server";
import type { HealthSnapshot, RecoveryPoint } from "@/lib/whoop-utils";

const TOKEN_ENDPOINT = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer/v1";

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
    throw new Error(`Failed to refresh Whoop access token (${response.status}).`);
  }

  return (await response.json()) as { access_token: string; expires_in: number };
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

    await supabase
      .from("whoop_connections")
      .update({
        access_token: refreshed.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return refreshed.access_token;
  } catch (error) {
    console.error("Failed to refresh Whoop token:", error);
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

// Returns null on any failure (no connection, expired refresh token, API
// error) so the UI can prompt to reconnect rather than crash.
export async function getHealthSnapshot(): Promise<HealthSnapshot | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

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
  if (cycles === null && recoveries === null && sleeps === null) return null;

  const stages = sleep?.score_state === "SCORED" ? sleep.score?.stage_summary : undefined;
  const sleepDurationMs = stages
    ? stages.total_light_sleep_time_milli +
      stages.total_slow_wave_sleep_time_milli +
      stages.total_rem_sleep_time_milli
    : null;

  const recoveryScored = recovery?.score_state === "SCORED" ? recovery.score : undefined;
  const cycleScored = cycle?.score_state === "SCORED" ? cycle.score : undefined;

  return {
    recoveryScore: recoveryScored ? Math.round(recoveryScored.recovery_score) : null,
    restingHeartRate: recoveryScored?.resting_heart_rate ?? null,
    hrvMilli: recoveryScored?.hrv_rmssd_milli ?? null,
    sleepDurationMs,
    sleepPerformancePercentage:
      sleep?.score_state === "SCORED" ? sleep.score?.sleep_performance_percentage ?? null : null,
    strain: cycleScored ? cycleScored.strain : null,
    asOf: recovery?.created_at ?? cycle?.start ?? sleep?.start ?? new Date().toISOString(),
  };
}

// Empty array (rather than null) on failure — the trend chart already
// renders a friendly "no data" state for zero points.
export async function getRecoveryTrend(days = 7): Promise<RecoveryPoint[]> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return [];

  const data = await whoopFetch<WhoopCollection<WhoopRecovery>>("/recovery", accessToken, {
    limit: String(days),
  });

  return (data?.records ?? [])
    .filter((record) => record.score_state === "SCORED" && record.score)
    .map((record) => ({
      date: record.created_at.slice(0, 10),
      recoveryScore: Math.round(record.score!.recovery_score),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
