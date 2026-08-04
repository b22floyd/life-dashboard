import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";

// 180x180 is Apple's recommended apple-touch-icon size — the icon shown on
// the iPhone/iPad home screen after "Add to Home Screen".
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconMark size={size.width} />, size);
}
