import { Skeleton, WidgetCardSkeleton } from "@/components/dashboard/Skeleton";
import {
  HealthCardSkeleton,
  JournalCardSkeleton,
  MealPlanGroceryCardSkeleton,
  TabbedListCardSkeleton,
  WorkoutCardSkeleton,
} from "@/components/dashboard/CardSkeletons";

// Next's route-level loading UI — shown immediately on navigation into the
// dashboard (e.g. right after signing in), before page.tsx's own per-card
// Suspense boundaries take over. Mirrors page.tsx's exact grid so there's no
// layout shift when the real shell streams in behind it.
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Life Dashboard
            </h1>
            <Skeleton className="mt-1 h-4 w-40" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-36 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-5 px-6 py-8 sm:grid-cols-2 lg:grid-cols-3">
        <WidgetCardSkeleton titleWidth="w-28" rows={4} />
        <TabbedListCardSkeleton titleWidth="w-24" />
        <TabbedListCardSkeleton titleWidth="w-32" />
        <WidgetCardSkeleton titleWidth="w-28" rows={5} />
        <WidgetCardSkeleton className="lg:col-span-3" titleWidth="w-28" rows={2} />
        <WidgetCardSkeleton titleWidth="w-40" rows={3} />
        <WidgetCardSkeleton titleWidth="w-48" rows={3} />
        <MealPlanGroceryCardSkeleton />
        <WidgetCardSkeleton titleWidth="w-20" rows={1} />
        <JournalCardSkeleton />
        <HealthCardSkeleton />
        <WorkoutCardSkeleton />
      </main>
    </div>
  );
}
