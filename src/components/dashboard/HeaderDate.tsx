"use client";

import { useHasMounted } from "@/lib/use-has-mounted";

// Header is a Server Component, which formats dates using the server's own
// timezone (UTC on Vercel) — that's what was showing hours ahead of local
// time. This renders client-side instead, so it reflects the browser's
// actual timezone. Stays blank until mounted rather than briefly showing
// the (wrong) server-computed date.
export function HeaderDate() {
  const mounted = useHasMounted();

  const today = mounted
    ? new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : " ";

  return <p className="text-sm text-zinc-500 dark:text-zinc-400">{today}</p>;
}
