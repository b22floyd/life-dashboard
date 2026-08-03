import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TOKEN_ENDPOINT = "https://api.prod.whoop.com/oauth/oauth2/token";

// Whoop's token endpoint returns a JSON body like
// {"error": "invalid_grant", "error_description": "..."} on failure.
// Falls back to the raw response text if it isn't JSON.
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

export async function GET(request: NextRequest) {
  const dashboardUrl = new URL("/", request.url);

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    const errorDescription = request.nextUrl.searchParams.get("error_description");
    console.error("Whoop OAuth consent error:", oauthError, errorDescription);
    dashboardUrl.searchParams.set("whoop_error", oauthError);
    if (errorDescription) {
      dashboardUrl.searchParams.set("whoop_error_detail", errorDescription);
    }
    return NextResponse.redirect(dashboardUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("whoop_oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    console.error("Whoop OAuth state mismatch:", { hasCode: Boolean(code), state, storedState });
    dashboardUrl.searchParams.set("whoop_error", "invalid_state");
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.delete("whoop_oauth_state");
    return response;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const redirectUri = new URL("/api/auth/callback/whoop", request.url).toString();

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const detail = await describeErrorResponse(tokenResponse);
    console.error("Whoop token exchange failed:", tokenResponse.status, detail);

    dashboardUrl.searchParams.set("whoop_error", "token_exchange_failed");
    dashboardUrl.searchParams.set("whoop_error_detail", detail);
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.delete("whoop_oauth_state");
    return response;
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  if (!tokens.refresh_token) {
    console.error("Whoop token exchange succeeded but returned no refresh_token.");
    dashboardUrl.searchParams.set("whoop_error", "missing_refresh_token");
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.delete("whoop_oauth_state");
    return response;
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: dbError } = await supabase.from("whoop_connections").upsert(
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
    console.error("Failed to store Whoop connection:", dbError.message);
    dashboardUrl.searchParams.set("whoop_error", "storage_failed");
    dashboardUrl.searchParams.set("whoop_error_detail", dbError.message);
  }

  const response = NextResponse.redirect(dashboardUrl);
  response.cookies.delete("whoop_oauth_state");
  return response;
}
