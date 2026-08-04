"use client";

import { useHasMounted } from "@/lib/use-has-mounted";
import { WidgetCard } from "./WidgetCard";

const MONARCH_URL = "https://www.monarchmoney.com";

function isMobileDevice(): boolean {
  const isSmallScreen = window.innerWidth < 768;
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return isSmallScreen || isMobileUserAgent;
}

export function MonarchCard() {
  const mounted = useHasMounted();
  // Server-rendered/pre-hydration default matches desktop (target="_blank")
  // — the same "render a reasonable default, silently upgrade after mount"
  // pattern WeatherWidget uses for its own isMobileDevice() check, so there's
  // no hydration mismatch, just a silent attribute swap on mobile once mounted.
  const isMobile = mounted && isMobileDevice();

  return (
    <WidgetCard title="Monarch">
      {/* No confirmed custom URL scheme for the Monarch app is publicly
          documented, so this doesn't attempt one — inventing an unverified
          scheme would silently do nothing if wrong, indistinguishable from
          "working" but not actually real. Instead this relies on Universal
          Links / App Links: navigating to the real monarchmoney.com URL as a
          same-tab top-level navigation lets iOS/Android hand off to the
          native app automatically if it's installed and registered for that
          domain, falling back to loading the site in the browser otherwise —
          the standard mechanism for exactly this "open app if installed"
          behavior, without guessing at a scheme. Desktop instead opens the
          web app in a new tab, since there's no app to hand off to there. */}
      <a
        href={MONARCH_URL}
        target={isMobile ? undefined : "_blank"}
        rel={isMobile ? undefined : "noopener noreferrer"}
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Open Monarch
        <span aria-hidden>↗</span>
      </a>
    </WidgetCard>
  );
}
