import { Skeleton } from "./Skeleton";

// Work Tasks and Upcoming Events share the same Today/Tomorrow/Upcoming
// tab-row shape, so one skeleton covers both (id differs per caller so a
// Today at a Glance click during loading still has something to scroll to).
export function TabbedListCardSkeleton({ id, titleWidth = "w-28" }: { id?: string; titleWidth?: string }) {
  return (
    <section
      id={id}
      className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className={`h-4 ${titleWidth}`} />
      </div>
      <div className="flex gap-4 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </section>
  );
}

// Mirrors the real card's shape: three recovery/sleep/strain stat tiles, the
// recovery trend chart, then the Weight Tracker section's goal/log forms.
export function HealthCardSkeleton() {
  return (
    <section
      id="health-section"
      className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-3"
    >
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-24 w-full rounded-lg" />
      <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <Skeleton className="h-4 w-28" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </section>
  );
}

// Mirrors the two-column Weekly Meal Plan / Grocery List split.
export function MealPlanGroceryCardSkeleton() {
  return (
    <section
      id="meal-plan-section"
      className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-3"
    >
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </section>
  );
}

// Mirrors the quick-log form on the left and the progress chart on the right.
export function WorkoutCardSkeleton() {
  return (
    <section className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-3">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-9 w-24 self-end rounded-full" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </section>
  );
}

// Mirrors the textarea plus the condensed upload/save button row beneath it.
export function JournalCardSkeleton() {
  return (
    <section className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="mt-3 flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </section>
  );
}

// Small pill-shaped fallbacks matching the resting shape of the header's own
// async widgets, so the header doesn't jump in width once they resolve.
export function WeatherSkeleton() {
  return <Skeleton className="h-8 w-16 rounded-full" />;
}

export function DailyGlanceSkeleton() {
  return <Skeleton className="h-8 w-36 rounded-full" />;
}
