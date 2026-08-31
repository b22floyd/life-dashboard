// Hand-written, no build step or Workbox — kept deliberately small and easy
// to fully audit given how much blast radius a service worker has (it can
// intercept every same-origin request the page makes, forever, until it's
// unregistered). Bump CACHE_NAME whenever the caching strategy below
// changes so the next activate() clears out anything cached under the old
// strategy instead of it lingering indefinitely.
//
// v2: split cache-first into two tiers (see isImmutableStaticAsset vs.
// isRevalidatableAsset below) — v1 treated the icon/manifest routes as
// cache-first-forever on the assumption that "the icon/manifest routes only
// change when their own source does, which bumps CACHE_NAME along with any
// other change to this file" — but that's only true if a developer *also*
// edits this file. Regenerating an icon (app-icon.tsx/manifest.ts) doesn't
// touch sw.js's own bytes at all, so the browser's byte-for-byte SW update
// check never fires, the old SW keeps running, and it serves the old icon
// from cache forever with no error and no path back to fresh content. This
// bump both clears out any icon already stuck in a v1 cache, and the
// revalidate-in-background strategy below means it can't happen again.
const CACHE_NAME = "life-dashboard-v2";
const OFFLINE_URL = "/offline";

// Fetched and cached individually (not via cache.addAll, which fails the
// *entire* precache if even one URL errors) so a transient hiccup on one
// icon route can never silently prevent the offline fallback page itself —
// by far the most important entry here — from being cached.
const PRECACHE_URLS = [OFFLINE_URL, "/icon-192", "/icon-512"];

function precacheAll(cache, urls) {
  return Promise.all(
    urls.map((url) =>
      fetch(url)
        .then((response) => (response && response.ok ? cache.put(url, response) : null))
        .catch(() => null),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => precacheAll(cache, PRECACHE_URLS))
      // Activates this version immediately on next load rather than waiting
      // for every open tab to close first — acceptable for a personal,
      // single-user app where "an old tab briefly runs a stale SW version"
      // is a non-issue, and far less annoying than updates never landing.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Next fingerprints every /_next/static/ filename per build, so a given
// URL's content genuinely never changes — safe to cache-first forever with
// no revalidation.
function isImmutableStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

// These have stable URLs but *can* change content (a redesigned icon, an
// edited manifest) without this file's own bytes changing, so a pure
// cache-first strategy here can get stuck serving stale content
// indefinitely — see the v2 note on CACHE_NAME above.
function isRevalidatableAsset(url) {
  return (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon" ||
    url.pathname === "/apple-icon" ||
    url.pathname === "/icon-192" ||
    url.pathname === "/icon-512" ||
    url.pathname.startsWith("/apple-splash/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever handle same-origin GET requests. Everything else — Server
  // Action POSTs, Supabase's own cross-origin REST/auth calls, OAuth
  // redirects to Google/Whoop/Todoist — is left completely untouched by
  // simply never calling event.respondWith(), which is the same as this
  // service worker not existing at all for that request. This dashboard is
  // fully dynamic, per-user, authenticated content; the one and only thing
  // this file ever caches is static build output plus the no-data,
  // unauthenticated /offline page itself.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Page navigations always go to the network first — never served from
    // a cache, since a stale or wrong-session dashboard snapshot would be
    // actively misleading (yesterday's habits shown as today's, a
    // completed task still shown as outstanding, etc.). The cached
    // /offline page is used *only* as a last resort when the network
    // request itself fails outright.
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error()),
      ),
    );
    return;
  }

  if (isImmutableStaticAsset(url)) {
    // Pure cache-first — there's never a "fresher" version of a given
    // content-hashed URL to revalidate against.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return response;
        });
      }),
    );
    return;
  }

  if (isRevalidatableAsset(url)) {
    // Stale-while-revalidate: respond from cache immediately if present
    // (so these still work offline and load instantly), but always also
    // fetch a fresh copy in the background and update the cache for next
    // time — the self-healing this class of route needs, since nothing
    // else here ever tells the browser a new version of *this specific
    // file* is available the way an sw.js byte change does for the SW
    // itself.
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const revalidate = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached || Response.error());
          if (cached) {
            event.waitUntil(revalidate);
            return cached;
          }
          return revalidate;
        }),
      ),
    );
    return;
  }

  // Everything else (API routes, RSC data fetches for client-side
  // navigations, etc.) intentionally falls through with no respondWith()
  // call — always live network, never cached.
});

// A push message's payload is whatever JSON the sending server (the daily
// reminder cron — see src/app/api/cron/push-reminders) put in it; falling
// back to plain text keeps this from silently dropping a malformed payload.
self.addEventListener("push", (event) => {
  let payload = { title: "Life Dashboard", body: "" };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "Life Dashboard", body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Life Dashboard", {
      body: payload.body,
      tag: payload.tag || "life-dashboard-notification",
      icon: "/icon-192",
    }),
  );
});

// Tapping the notification focuses an already-open dashboard tab if one
// exists, rather than always opening a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    }),
  );
});
