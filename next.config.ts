import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonce/proxy-based CSP here deliberately — this app has no proxy-set
// per-request nonce, and its charts/splash-screen/icon-generator components
// rely on inline `style={{...}}` throughout, which a nonce-based
// `style-src` would break unless every one of them were rewritten. This is
// exactly the documented "without nonces" baseline from Next's own CSP
// guide: still blocks any *externally injected* script/stylesheet/frame
// (the actual point of a CSP for an app with zero third-party client-side
// scripts), just without the extra 'unsafe-inline' protection nonces buy.
// 'unsafe-eval' is needed in dev only — React's dev-mode error reconstruction
// relies on it; production never uses eval.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Voice memo uploads for journal transcription; matches Whisper's own cap.
      bodySizeLimit: "25mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          // Belt-and-suspenders alongside frame-ancestors above — older
          // browsers that don't support CSP's frame-ancestors still get
          // clickjacking protection from this.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // geolocation stays enabled for WeatherWidget's "use my location"
          // button; nothing in this app touches the camera or microphone
          // (Journal's voice memo is a plain file upload, not getUserMedia).
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          // Safe on Vercel, which always serves over HTTPS.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
