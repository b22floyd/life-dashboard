import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest) {
  const dashboardUrl = new URL("/", request.url);

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    dashboardUrl.searchParams.set("google_error", oauthError);
    return NextResponse.redirect(dashboardUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("google_oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    dashboardUrl.searchParams.set("google_error", "invalid_state");
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.delete("google_oauth_state");
    return response;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const redirectUri = new URL("/api/auth/callback/google", request.url).toString();

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    dashboardUrl.searchParams.set("google_error", "token_exchange_failed");
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.delete("google_oauth_state");
    return response;
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  // Google only issues a refresh token on first consent, which is why we
  // always send prompt=consent — but guard rather than silently storing a
  // connection that can't be renewed once the access token expires.
  if (!tokens.refresh_token) {
    dashboardUrl.searchParams.set("google_error", "missing_refresh_token");
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.delete("google_oauth_state");
    return response;
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: dbError } = await supabase.from("google_calendar_connections").upsert(
    {
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (dbError) {
    dashboardUrl.searchParams.set("google_error", "storage_failed");
  }

  const response = NextResponse.redirect(dashboardUrl);
  response.cookies.delete("google_oauth_state");
  return response;
}
