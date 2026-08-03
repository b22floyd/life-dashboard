import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const WHOOP_AUTH_ENDPOINT = "https://api.prod.whoop.com/oauth/oauth2/auth";
// "offline" gets a refresh token issued alongside the access token.
const SCOPE = "read:recovery read:cycles read:sleep offline";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/callback/whoop", request.url).toString();

  const authUrl = new URL(WHOOP_AUTH_ENDPOINT);
  authUrl.searchParams.set("client_id", process.env.WHOOP_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("whoop_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
