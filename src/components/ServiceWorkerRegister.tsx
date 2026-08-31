"use client";

import { useEffect } from "react";

// Registers public/sw.js on mount. Mounted once in the root layout
// (alongside AppSplashOverlay) so it's present on every page regardless of
// auth state — the service worker itself needs to be registered before the
// user ever hits a moment with no connection, not only once they're signed
// in. A registration failure (an unsupported browser, or a sandboxed/
// incognito context that blocks service workers entirely) is silently
// ignored: this is a progressive enhancement on top of an app that already
// works fully without one, not something to surface as an error.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
