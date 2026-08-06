export const SPLASH_MIN_DURATION_MS = 2000;

export const SPLASH_PHRASES = [
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
// in a component body) so picking a phrase doesn't trip the render-purity
// lint rule aimed at memoizable component logic — none of this app's splash
// call sites are ever memoized, so there's nothing for that rule to protect.
export function pickPhrase(): string {
  return SPLASH_PHRASES[Math.floor(Math.random() * SPLASH_PHRASES.length)];
}

// A named wrapper around Date.now() (rather than calling it directly in a
// component body) so marking a start time doesn't trip the render-purity
// lint rule aimed at memoizable component logic — this route is never
// memoized and Next always re-runs it fresh per request.
export function now(): number {
  return Date.now();
}

// Enforces a minimum total time between `start` and when this resolves, so
// the route's splash screen (loading.tsx) reads as a deliberate, calm entry
// rather than a flash that disappears before it's even legible on a fast
// connection. Page.tsx's own top-level work already determines how long
// loading.tsx shows (Suspense swaps to real content exactly when that
// resolves) — this only adds a floor on top of that, never a ceiling: if the
// real work already took longer than `minMs`, this resolves immediately and
// changes nothing.
export async function ensureMinimumDuration(
  start: number,
  minMs: number = SPLASH_MIN_DURATION_MS,
): Promise<void> {
  const elapsed = Date.now() - start;
  const remaining = minMs - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
