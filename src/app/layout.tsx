import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSplashOverlay } from "@/components/AppSplashOverlay";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { APPLE_SPLASH_DEVICES, DEFAULT_SPLASH_DEVICE, splashImageKey } from "@/lib/apple-splash-devices";
import { pickPhrase } from "@/lib/splash";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Life Dashboard",
  description: "A personal life dashboard for tasks, habits, events, and finances.",
  // Home screen label and standalone-mode window title on iOS. `manifest`
  // itself doesn't need to be declared here — the file-based app/manifest.ts
  // convention links it automatically.
  appleWebApp: {
    title: "Life Dashboard",
    // "black" (opaque, matching the header's own dark surface) rather than
    // "black-translucent" — the latter draws content edge-to-edge under the
    // status bar, which needs safe-area-inset padding this app doesn't have
    // yet and would otherwise clip the header on notched iPhones.
    statusBarStyle: "black",
    // iOS's own native launch-screen image for standalone (home-screen)
    // launches — this is what's actually shown in the gap between tapping
    // the icon and the real page loading. The manifest's background_color
    // is NOT honored for this by iOS the way it is on Android/desktop, so
    // without this, that gap is a plain white screen no matter how the web
    // app's own splash is built, since none of this app's own HTML/CSS/JS
    // has started loading yet at that point. One entry per device bucket in
    // apple-splash-devices.ts, most specific first; the last, media-less
    // entry is a catch-all for any device none of the specific ones match.
    startupImage: [
      ...APPLE_SPLASH_DEVICES.map((device) => ({
        url: `/apple-splash/${splashImageKey(device)}`,
        media: `(device-width: ${device.cssWidth}px) and (device-height: ${device.cssHeight}px) and (-webkit-device-pixel-ratio: ${device.dpr}) and (orientation: portrait)`,
      })),
      `/apple-splash/${splashImageKey(DEFAULT_SPLASH_DEVICE)}`,
    ],
  },
  other: {
    // appleWebApp above already emits the modern, unprefixed
    // "mobile-web-app-capable" tag, but iOS Safari has historically only
    // honored its own vendor-prefixed version for actually launching in
    // standalone mode (no address bar) from a home screen icon — this is
    // the tag that request is really asking for, so it's set explicitly
    // rather than assumed.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  // Matches the header's own bg-white / dark:bg-zinc-950, so the browser
  // chrome (and, on Android, the status bar) blends with the app instead of
  // showing a mismatched default color while it loads.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <AppSplashOverlay phrase={pickPhrase()} />
        {children}
      </body>
    </html>
  );
}
