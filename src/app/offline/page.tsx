// The service worker's navigation fallback (see public/sw.js) — served
// straight from Cache Storage, with no network round trip at all, whenever
// a page navigation fails because there's no connection. Deliberately a
// plain static page with no data of its own (matching /privacy and /login
// in being public rather than auth-gated — see middleware.ts): it has to
// render correctly for a request that, by definition, is happening because
// the network is unreachable, so it can't depend on anything beyond what
// the service worker already cached at install time.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <p className="text-xs font-medium tracking-[0.2em] text-zinc-400 uppercase dark:text-zinc-600">
        Life Dashboard
      </p>
      <div className="flex flex-col items-center gap-2">
        <p className="text-2xl font-medium tracking-tight text-zinc-800 dark:text-zinc-100">
          You&apos;re offline
        </p>
        <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          Your dashboard needs a connection to load. It&apos;ll be right here once you&apos;re back
          online.
        </p>
      </div>
      {/* A plain <a>, deliberately not next/link: Link performs a
          client-side transition (an RSC data fetch, not a real page
          navigation), which the service worker's fetch handler only
          special-cases for request.mode === "navigate" — a genuine
          browser-level navigation. Re-requesting "/" this way is exactly
          what should happen either way: the service worker serves the real
          dashboard if the network is back, or this same offline page again
          if it isn't, with no JS needed here at all. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see comment above */}
      <a
        href="/"
        className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Try Again
      </a>
    </div>
  );
}
