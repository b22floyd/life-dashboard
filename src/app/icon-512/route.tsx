import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";

// Same idea as icon-192/route.tsx, at the larger size manifest.ts references
// for high-res displays and for iOS's manifest-driven splash screen.
export async function GET() {
  return new ImageResponse(<AppIconMark size={512} />, { width: 512, height: 512 });
}
