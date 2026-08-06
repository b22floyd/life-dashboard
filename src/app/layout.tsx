import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSplashOverlay } from "@/components/AppSplashOverlay";
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
        <AppSplashOverlay phrase={pickPhrase()} />
        {children}
      </body>
    </html>
  );
}
