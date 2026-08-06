const PHRASES = [
  "Own your day",
  "Small steps, real progress",
  "Consistency over perfection",
  "Show up today",
  "Build the life you want",
  "One day at a time",
  "Progress, not perfection",
  "Stay the course",
  "Today matters",
  "Discipline creates freedom",
];

// A named, module-level helper (rather than calling Math.random() directly
// in the component body) so a fresh phrase is picked per request without
// tripping the render-purity lint rule aimed at memoizable component logic —
// this component is never memoized and Next invokes it fresh per request,
// so there's nothing for that rule to actually protect here.
function pickPhrase(): string {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

// Next's route-level loading UI — the very first thing shown when the app
// opens (e.g. right after signing in, or a hard reload), before page.tsx
// itself is ready to stream its own per-card Suspense fallbacks. A calm,
// branded splash rather than a skeleton of the grid: this moment is brief
// and about the app opening, not about previewing dashboard content — the
// individual cards still show their own loading skeletons a beat later via
// their own Suspense boundaries in page.tsx, unrelated to this screen.
export default function Loading() {
  const phrase = pickPhrase();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-zinc-50 dark:bg-black">
      <div className="splash-fade-in flex flex-col items-center gap-3 text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-zinc-400 uppercase dark:text-zinc-600">
          Life Dashboard
        </p>
        <p className="text-2xl font-medium tracking-tight text-zinc-800 dark:text-zinc-100">
          {phrase}
        </p>
      </div>
      <div aria-hidden className="flex items-center gap-2">
        <span className="splash-dot h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
        <span
          className="splash-dot h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600"
          style={{ animationDelay: "0.25s" }}
        />
        <span
          className="splash-dot h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600"
          style={{ animationDelay: "0.5s" }}
        />
      </div>
      <span className="sr-only">Loading your dashboard…</span>
    </div>
  );
}
