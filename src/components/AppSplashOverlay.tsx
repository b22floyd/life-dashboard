"use client";

import { useEffect, useState } from "react";
import { SPLASH_MIN_DURATION_MS } from "@/lib/splash";
import { SplashScreen } from "./SplashScreen";

// Route-level loading.tsx only shows while page.tsx's own Suspense boundary
// is pending — reliable for a client-side transition (e.g. the redirect
// right after signing in, which React handles as an in-page Suspense swap),
// but not for a genuine fresh page load (a hard reload, a brand-new browser
// tab, or relaunching the installed PWA from a home screen icon). Browsers
// are free to buffer or paint a streamed SSR response differently than a
// client-side transition, so the exact same server-rendered fallback HTML
// that reliably shows for one case can go visually unnoticed for the other.
//
// This sidesteps that entirely by not depending on Suspense/streaming
// timing at all: mounted once in the root layout, so it's present in every
// real page load's initial render, and its dismissal timer runs from
// `performance.now()` — time since the *browser's own navigation started*,
// not since this component happened to mount — so it still hits the same
// floor even if hydration itself was slow. It deliberately does NOT persist
// any "already shown" flag: a fresh page load always gets a fresh mount
// (and therefore always shows this), while an in-app client-side transition
// (the root layout isn't remounted) correctly never retriggers it — that's
// not a new app open, just internal navigation.
export function AppSplashOverlay({ phrase }: { phrase: string }) {
  const [phase, setPhase] = useState<"visible" | "exiting" | "gone">("visible");

  useEffect(() => {
    const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - performance.now());
    const showTimer = setTimeout(() => setPhase("exiting"), remaining);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (phase !== "exiting") return;
    // Matches the duration-300 transition below — long enough to read as a
    // deliberate fade, not so long it delays getting out of the way once
    // the minimum has already elapsed.
    const removeTimer = setTimeout(() => setPhase("gone"), 300);
    return () => clearTimeout(removeTimer);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-hidden={phase === "exiting"}
      className={`fixed inset-0 z-[100] transition-opacity duration-300 motion-reduce:transition-none ${
        phase === "exiting" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <SplashScreen phrase={phrase} />
    </div>
  );
}
