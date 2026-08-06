"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

// Re-runs the Server Component tree for the current route (re-fetching
// whatever failed) without a full page reload — the lightest-weight retry
// available for a Server Component that came back with a load error.
export function RetryButton({ label = "Retry" }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-100"
    >
      {isPending ? "Retrying…" : label}
    </button>
  );
}
