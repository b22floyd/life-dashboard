export type AppleSplashDevice = {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
};

// Portrait CSS-viewport buckets covering the current iPhone lineup (roughly
// SE/6 through 16 Pro Max). Apple keeps the exact CSS width/height/DPR
// triple stable across several model generations even as the marketing name
// or physical resolution changes, so each entry below typically matches
// more than one real device — the comment names the ones it covers.
// Landscape isn't covered: a dashboard is realistically checked portrait,
// and the cost of doubling this list wasn't worth it for that case.
export const APPLE_SPLASH_DEVICES: AppleSplashDevice[] = [
  { cssWidth: 375, cssHeight: 667, dpr: 2 }, // SE (2nd/3rd gen), 6/7/8
  { cssWidth: 414, cssHeight: 736, dpr: 3 }, // 6/7/8 Plus
  { cssWidth: 375, cssHeight: 812, dpr: 3 }, // X/XS/11 Pro, 12 mini/13 mini
  { cssWidth: 414, cssHeight: 896, dpr: 2 }, // XR/11
  { cssWidth: 414, cssHeight: 896, dpr: 3 }, // XS Max/11 Pro Max
  { cssWidth: 390, cssHeight: 844, dpr: 3 }, // 12/12 Pro/13/13 Pro/14
  { cssWidth: 428, cssHeight: 926, dpr: 3 }, // 12 Pro Max/13 Pro Max/14 Plus
  { cssWidth: 393, cssHeight: 852, dpr: 3 }, // 14 Pro/15/15 Pro/16 — DEFAULT_SPLASH_DEVICE below
  { cssWidth: 430, cssHeight: 932, dpr: 3 }, // 15 Plus/15 Pro Max/16 Plus
  { cssWidth: 402, cssHeight: 874, dpr: 3 }, // 16 Pro
  { cssWidth: 440, cssHeight: 956, dpr: 3 }, // 16 Pro Max
];

// Used as the unconditional (no media query) fallback entry in
// layout.tsx's startupImage list, for any device none of the specific
// buckets above match — one of the most common current sizes, a
// reasonable middle-of-the-road default.
export const DEFAULT_SPLASH_DEVICE = APPLE_SPLASH_DEVICES[7];

// The route key/URL segment — the device's actual physical pixel
// dimensions, since that's what the generated image itself needs to be.
export function splashImageKey(device: AppleSplashDevice): string {
  return `${device.cssWidth * device.dpr}x${device.cssHeight * device.dpr}`;
}
