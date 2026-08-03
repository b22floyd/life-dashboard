import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/google-calendar-utils";

export type { CalendarEvent };

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function isGoogleCalendarConnected(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("google_calendar_connections")
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
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Google access token (${response.status}).`);
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
    .from("google_calendar_connections")
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
      .from("google_calendar_connections")
      .update({
        access_token: refreshed.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return refreshed.access_token;
  } catch (error) {
    console.error("Failed to refresh Google Calendar token:", error);
    return null;
  }
}

// Returns null on any failure (no connection, expired refresh token, API
// error) so the UI can prompt to reconnect rather than crash. Fetches more
// than the visible 5-per-group cap since events now split into Today and
// Upcoming sections, each with its own scrollable ~5-item window.
export async function getUpcomingEvents(maxResults = 20): Promise<CalendarEvent[] | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const url = new URL(EVENTS_ENDPOINT);
  url.searchParams.set("timeMin", new Date().toISOString());
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Failed to reach Google Calendar:", error);
    return null;
  }

  if (!response.ok) {
    console.error("Google Calendar API error:", response.status);
    return null;
  }

  const data = (await response.json()) as {
    items?: { id: string; summary?: string; start?: { dateTime?: string; date?: string } }[];
  };

  return (data.items ?? []).map((item) => ({
    id: item.id,
    title: item.summary ?? "(No title)",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    isAllDay: !item.start?.dateTime,
  }));
}

export async function revokeGoogleToken(token: string) {
  await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
    method: "POST",
  }).catch((error) => {
    console.error("Failed to revoke Google token:", error);
  });
}
