import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";

// A plain route (not the icon.tsx/apple-icon.tsx file convention) so it has
// a stable, known URL — /icon-192 — that manifest.ts can reference directly
// for its 192x192 icon entry, the size most installed-PWA launchers use.
export async function GET() {
  return new ImageResponse(<AppIconMark size={192} />, { width: 192, height: 192 });
}
