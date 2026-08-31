// Hand-written, no build step or Workbox — kept deliberately small and easy
// to fully audit given how much blast radius a service worker has (it can
// intercept every same-origin request the page makes, forever, until it's
// unregistered). Bump CACHE_NAME whenever the caching strategy below
// changes so the next activate() clears out anything cached under the old
// strategy instead of it lingering indefinitely.
const CACHE_NAME = "life-dashboard-v1";
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

function isCacheableStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
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

  if (isCacheableStaticAsset(url)) {
    // Cache-first: safe here specifically because Next fingerprints every
    // /_next/static/ filename per build (a given URL's content never
    // changes), and the icon/manifest routes only change when their own
    // source does, which bumps CACHE_NAME above along with any other
    // change to this file.
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
  }

  // Everything else (API routes, RSC data fetches for client-side
  // navigations, etc.) intentionally falls through with no respondWith()
  // call — always live network, never cached.
});
