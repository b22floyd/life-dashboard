import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token if needed; required for Server Components to
  // read a valid session, since they can't write cookies themselves.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  // Public — no auth required, and no redirect either way (e.g. for
  // Google OAuth consent-screen verification, which needs a reachable
  // privacy policy URL).
  const isPrivacyPage = request.nextUrl.pathname.startsWith("/privacy");
  // The weekly backup cron has no signed-in session — Vercel invokes it
  // directly with no cookies — so it can't go through the login redirect.
  // It's authorized separately inside the route via a CRON_SECRET bearer
  // token instead.
  const isCronRoute = request.nextUrl.pathname.startsWith("/api/cron");
  // PWA icon/manifest routes — fetched by the browser/OS itself (e.g. while
  // adding the app to an iPhone home screen) with no user session, and
  // extension-less, so they don't already match the proxy matcher's
  // file-extension exclusions. A redirect to /login here would silently
  // break the home screen icon and installability for anyone not currently
  // signed in.
  const isPwaAssetRoute =
    [
      "/manifest.webmanifest",
      "/icon",
      "/apple-icon",
      "/icon-192",
      "/icon-512",
      // The service worker script itself (public/sw.js) — the proxy
      // matcher's negative-lookahead only excludes image extensions, not
      // .js, so without this a redirect-to-/login response would get
      // registered as the service worker (or served back for the browser's
      // own periodic update-check fetch) instead of the real script.
      "/sw.js",
    ].includes(request.nextUrl.pathname) ||
    // iOS's native standalone-launch splash image — dynamically-sized
    // (/apple-splash/<width>x<height>), so it needs a prefix match rather
    // than the exact-path list above. Fetched the same cookie-less way as
    // the icons: a redirect to /login here would mean the actual "AppSplash
    // startup image" iOS shows before the page ever loads is just a broken
    // image / the default blank white screen this whole thing exists to fix.
    request.nextUrl.pathname.startsWith("/apple-splash/");
  // The service worker's offline navigation fallback (public/sw.js) — has
  // to be reachable two ways that both predate any session being known:
  // the service worker's own install-time precache fetch (which happens
  // the moment the app is first opened, before or regardless of sign-in),
  // and being served straight from Cache Storage with no network request
  // reaching this middleware at all once genuinely offline. A redirect to
  // /login here would mean the *cached* copy of this page is the login
  // page instead of the real offline message.
  const isOfflinePage = request.nextUrl.pathname.startsWith("/offline");
  if (!user && !isLoginPage && !isPrivacyPage && !isCronRoute && !isPwaAssetRoute && !isOfflinePage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
