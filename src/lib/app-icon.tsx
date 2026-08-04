// Shared visual for every generated app icon (favicon, apple-touch-icon, and
// the two manifest sizes) so they're all pixel-for-pixel the same mark, just
// rendered at different sizes. Pure shapes (no text/font) — Satori (which
// ImageResponse uses under the hood) only reliably renders a default
// fallback font unless a font file is explicitly loaded, so a lettermark
// risked looking thin or uneven at small sizes; three simple bars read as a
// "list/checklist" glyph, which fits a dashboard that's mostly lists
// (tasks, habits, cleaning, contacts, ...), without that risk.
//
// Colors are the app's own zinc-900 / zinc-50 — the exact tokens already
// used for every primary button and dark-mode surface elsewhere in the app.
export function AppIconMark({ size }: { size: number }) {
  const barHeight = size * 0.11;
  const gap = size * 0.13;
  const barWidths = [0.6, 0.48, 0.36];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#18181b",
        borderRadius: size * 0.22,
        gap,
      }}
    >
      {barWidths.map((width, i) => (
        <div
          key={i}
          style={{
            width: size * width,
            height: barHeight,
            borderRadius: barHeight / 2,
            background: "#fafafa",
          }}
        />
      ))}
    </div>
  );
}
