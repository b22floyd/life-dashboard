import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";
import { APPLE_SPLASH_DEVICES, splashImageKey } from "@/lib/apple-splash-devices";

// Built once at module scope from the fixed device list — this route can
// only ever render one of those known sizes, not an arbitrary width/height
// from the URL, since ImageResponse has no natural upper bound of its own.
const ALLOWED_SIZES = new Map(
  APPLE_SPLASH_DEVICES.map((device) => {
    const width = device.cssWidth * device.dpr;
    const height = device.cssHeight * device.dpr;
    return [splashImageKey(device), { width, height }];
  }),
);

// iOS's own native launch-screen image for "Add to Home Screen" mode —
// referenced via <link rel="apple-touch-startup-image"> in layout.tsx's
// appleWebApp.startupImage. This is what iOS shows in the instant between
// tapping the home-screen icon and the real page loading; without it, iOS
// falls back to a plain white screen for that whole window, regardless of
// this app's own manifest theme/background colors (those aren't honored by
// standalone-mode launches the way this dedicated mechanism is). Same
// solid background plus centered mark used for every other generated icon
// in this app, just at each device's native screen resolution.
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const dimensions = ALLOWED_SIZES.get(size);
  if (!dimensions) {
    return new Response("Not found", { status: 404 });
  }

  const { width, height } = dimensions;
  const iconSize = Math.round(Math.min(width, height) * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#18181b",
        }}
      >
        <AppIconMark size={iconSize} />
      </div>
    ),
    { width, height },
  );
}
