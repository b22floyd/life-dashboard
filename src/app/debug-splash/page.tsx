"use client";

import { useSyncExternalStore } from "react";

type StartupLinkInfo = {
  href: string;
  media: string | null;
  matches: boolean;
};

type DiagnosticInfo = {
  screenWidth: number;
  screenHeight: number;
  innerWidth: number;
  innerHeight: number;
  dpr: number;
  isStandalone: boolean;
  userAgent: string;
  startupLinks: StartupLinkInfo[];
};

// A throwaway diagnostic page, not a real app feature — meant to be opened
// directly on the actual device having trouble, since it reads the *real*
// apple-touch-startup-image <link> tags this page was served with and asks
// WebKit's own matchMedia() whether each one's media query matches this
// exact device, rather than guessing from sourced spec numbers. This
// answers "are the tags actually deployed" and "does one actually match
// this device" in one shot, using ground truth instead of another fetch
// this environment can't make. Safe to delete once the underlying iOS
// splash issue is confirmed fixed.

// A one-time snapshot of browser globals, following the same
// useSyncExternalStore pattern as useHasMounted — cached after the first
// read so repeated calls return the same reference (required for
// useSyncExternalStore to not treat every render as a change), and avoids
// the "setState in an effect" render-purity lint rule a plain useEffect
// here would trip.
let cachedSnapshot: DiagnosticInfo | null = null;

function computeSnapshot(): DiagnosticInfo {
  if (cachedSnapshot) return cachedSnapshot;

  const links = Array.from(document.querySelectorAll('link[rel="apple-touch-startup-image"]'));
  const startupLinks: StartupLinkInfo[] = links.map((link) => {
    const media = link.getAttribute("media");
    return {
      href: link.getAttribute("href") ?? "",
      media,
      // No media attribute at all means the link is the unconditional
      // fallback — it always "matches" in the sense that WebKit will use
      // it if nothing more specific did.
      matches: media ? window.matchMedia(media).matches : true,
    };
  });

  const nav = window.navigator as Navigator & { standalone?: boolean };

  cachedSnapshot = {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    dpr: window.devicePixelRatio,
    isStandalone:
      nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches,
    userAgent: navigator.userAgent,
    startupLinks,
  };
  return cachedSnapshot;
}

function getServerSnapshot(): DiagnosticInfo | null {
  return null;
}

const subscribe = () => () => {};

export default function DebugSplashPage() {
  const info = useSyncExternalStore(subscribe, computeSnapshot, getServerSnapshot);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 16px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        lineHeight: 1.6,
        background: "#ffffff",
        color: "#111111",
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 16, fontFamily: "sans-serif" }}>
        Splash Screen Diagnostic
      </h1>

      {!info ? (
        <p>Loading…</p>
      ) : (
        <>
          <Row label="screen.width × screen.height" value={`${info.screenWidth} × ${info.screenHeight}`} />
          <Row label="devicePixelRatio" value={String(info.dpr)} />
          <Row label="innerWidth × innerHeight" value={`${info.innerWidth} × ${info.innerHeight}`} />
          <Row label="Launched standalone (home screen)" value={String(info.isStandalone)} />
          <Row label="userAgent" value={info.userAgent} wrap />

          <hr style={{ margin: "20px 0" }} />

          <h2 style={{ fontSize: 15, marginBottom: 10, fontFamily: "sans-serif" }}>
            apple-touch-startup-image links on this exact page load ({info.startupLinks.length} found)
          </h2>

          {info.startupLinks.length === 0 ? (
            <p style={{ color: "#b91c1c", fontWeight: "bold" }}>
              None found — this page was served without any startup-image tags at all. That means
              either the fix hasn&apos;t deployed to whatever you&apos;re looking at, or something is
              stripping them before they reach the browser.
            </p>
          ) : (
            <ul style={{ paddingLeft: 0, listStyle: "none" }}>
              {info.startupLinks.map((link, i) => (
                <li
                  key={i}
                  style={{
                    marginBottom: 10,
                    padding: 8,
                    borderRadius: 6,
                    background: link.matches ? "#dcfce7" : "#f4f4f5",
                    color: link.matches ? "#166534" : "#52525b",
                  }}
                >
                  <div>{link.matches ? "✅ MATCHES this device" : "— does not match"}</div>
                  <div>{link.href}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{link.media ?? "(no media — fallback)"}</div>
                </li>
              ))}
            </ul>
          )}

          <hr style={{ margin: "20px 0" }} />

          <p style={{ fontFamily: "sans-serif", fontWeight: "bold" }}>
            {info.startupLinks.some((l) => l.matches)
              ? "A startup-image link matches this device — iOS should be using it."
              : info.startupLinks.length > 0
                ? "The tags are present, but none of their media queries match this exact device — this is the bug."
                : "No tags present at all — see above."}
          </p>
        </>
      )}
    </div>
  );
}

function Row({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return (
    <p style={{ marginBottom: 4, wordBreak: wrap ? "break-all" : "normal" }}>
      <strong>{label}:</strong> {value}
    </p>
  );
}
