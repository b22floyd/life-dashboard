import { getSectionAccentClass } from "@/lib/section-category";

// Tailwind's built-in `animate-pulse` (a subtle opacity pulse) rather than a
// custom gradient-sweep shimmer — it's the standard, dependency-free way to
// signal "loading" without writing new keyframes, and reads as the same
// "subtle gray shimmer" the rest of the app's neutral palette already uses.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className ?? ""}`} />
  );
}

// Generic Suspense fallback for any card whose real content is basically "a
// title plus a handful of list rows" — Personal Tasks, Habit Streaks, Annual
// Goals, Routine Cleaning Reminders, Contacts. Cards with a more distinctive
// shape (tabs, a chart, a form) get their own skeleton in CardSkeletons.tsx
// instead of this one. `className` and `id` should mirror exactly what the
// real card passes to WidgetCard, so the skeleton occupies the same grid
// slot (no layout shift when the real content swaps in) and, for cards
// Today at a Glance can scroll to, a click during loading still has an
// element with the right id to scroll to.
export function WidgetCardSkeleton({
  className,
  id,
  titleWidth = "w-32",
  rows = 3,
}: {
  className?: string;
  id?: string;
  titleWidth?: string;
  rows?: number;
}) {
  return (
    <section
      id={id}
      className={`flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${getSectionAccentClass(id)} ${className ?? ""}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className={`h-4 ${titleWidth}`} />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </section>
  );
}
