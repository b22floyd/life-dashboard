"use client";

import { useEffect } from "react";

// The route's last-resort error boundary — Next.js requires this to be a
// Client Component. Every card and Header widget already has its own
// SectionErrorBoundary, so an unexpected exception in one of those never
// reaches this far; this only catches something outside all of them (e.g.
// page.tsx or Header's own top-level code, not any individual card).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong loading the dashboard.
      </p>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        This wasn&apos;t just one section — try reloading the page. If it keeps happening, your
        data itself is safe; this is just a display problem.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Try again
      </button>
    </div>
  );
}
