import type { MetadataRoute } from "next";

// Next auto-generates /manifest.webmanifest from this file and links it in
// <head> — no need to also set metadata.manifest in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life Dashboard",
    short_name: "Dashboard",
    description: "A personal life dashboard for tasks, habits, events, health, and more.",
    start_url: "/",
    scope: "/",
    // The setting that actually makes "Add to Home Screen" open without the
    // browser chrome (address bar, tab strip) — the core of this request.
    display: "standalone",
    // Matches the icon's own background — also what recent iOS Safari
    // (16.4+) fills behind the icon/name when it synthesizes a launch
    // screen from this manifest, so the splash reads as one cohesive brand
    // moment rather than a plain white flash before the real page paints.
    background_color: "#18181b",
    theme_color: "#18181b",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
