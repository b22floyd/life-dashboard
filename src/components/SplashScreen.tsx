// Pure presentational markup shared by the two places the splash appears:
// loading.tsx's Suspense fallback (a no-JS/slow-hydration backstop) and
// AppSplashOverlay's client-driven, guaranteed-visible overlay. Kept as a
// plain function component (no hooks, no "use client") so it works
// identically whether its parent is a Server or Client Component.
export function SplashScreen({ phrase }: { phrase: string }) {
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
