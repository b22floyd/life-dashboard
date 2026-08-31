import { Suspense } from "react";
import { getSectionOrder } from "@/lib/dashboard-section-order";
import { resolveSectionOrder } from "@/lib/dashboard-sections";
import { ensureMinimumDuration, now } from "@/lib/splash";
import { SectionOrderBoard } from "@/components/dashboard/SectionOrderBoard";
import { SectionErrorBoundary } from "@/components/dashboard/SectionErrorBoundary";
import { Header } from "@/components/dashboard/Header";
import { PersonalTasksCard } from "@/components/dashboard/PersonalTasksCard";
import { TasksCard } from "@/components/dashboard/TasksCard";
import { HabitsCard } from "@/components/dashboard/HabitsCard";
import { AnnualGoalsCard } from "@/components/dashboard/AnnualGoalsCard";
import { CleaningCard } from "@/components/dashboard/CleaningCard";
import { ContactsCard } from "@/components/dashboard/ContactsCard";
import { MealPlanGroceryCard } from "@/components/dashboard/MealPlanGroceryCard";
import { EventsCard } from "@/components/dashboard/EventsCard";
import { JournalCardLoader } from "@/components/dashboard/JournalCardLoader";
import { WorkoutCardLoader } from "@/components/dashboard/WorkoutCardLoader";
import { HealthCard } from "@/components/dashboard/HealthCard";
import { NavRail } from "@/components/dashboard/NavRail";
import { WidgetCardSkeleton } from "@/components/dashboard/Skeleton";
import {
  HealthCardSkeleton,
  JournalCardSkeleton,
  MealPlanGroceryCardSkeleton,
  TabbedListCardSkeleton,
  WorkoutCardSkeleton,
} from "@/components/dashboard/CardSkeletons";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    google_error?: string;
    google_error_detail?: string;
    whoop_error?: string;
    whoop_error_detail?: string;
  }>;
}) {
  const splashStart = now();

  const {
    google_error: googleError,
    google_error_detail: googleErrorDetail,
    whoop_error: whoopError,
    whoop_error_detail: whoopErrorDetail,
  } = await searchParams;

  const savedOrder = await getSectionOrder();
  const sectionOrder = resolveSectionOrder(savedOrder);

  // Route-level loading.tsx (the splash) is shown by Next for exactly as
  // long as this function takes to resolve — on a fast connection that's
  // often under 100ms, too quick for the phrase to actually be read. This
  // holds the splash open until at least 2s have passed since the request
  // started, and does nothing if the work above already took longer than
  // that (never cuts a genuinely slow load short, never adds a ceiling).
  await ensureMinimumDuration(splashStart);

  const sections = [
    {
      id: "personal-tasks-section",
      node: (
        <SectionErrorBoundary key="personal-tasks-section" label="Personal Tasks">
          <Suspense
            fallback={<WidgetCardSkeleton id="personal-tasks-section" titleWidth="w-28" rows={4} />}
          >
            <PersonalTasksCard />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "work-tasks-section",
      node: (
        <SectionErrorBoundary key="work-tasks-section" label="Work Tasks">
          <Suspense fallback={<TabbedListCardSkeleton id="work-tasks-section" titleWidth="w-24" />}>
            <TasksCard />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "events-section",
      node: (
        <SectionErrorBoundary key="events-section" label="Upcoming Events">
          <Suspense fallback={<TabbedListCardSkeleton id="events-section" titleWidth="w-32" />}>
            <EventsCard error={googleError} errorDetail={googleErrorDetail} />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "habits-section",
      node: (
        <SectionErrorBoundary key="habits-section" label="Habit Streaks">
          <Suspense fallback={<WidgetCardSkeleton id="habits-section" titleWidth="w-28" rows={5} />}>
            <HabitsCard />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "annual-goals-section",
      node: (
        <SectionErrorBoundary key="annual-goals-section" label="Annual Goals">
          <Suspense
            fallback={
              <WidgetCardSkeleton
                id="annual-goals-section"
                className="lg:col-span-3"
                titleWidth="w-28"
                rows={2}
              />
            }
          >
            <AnnualGoalsCard />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "cleaning-section",
      node: (
        <SectionErrorBoundary key="cleaning-section" label="Routine Cleaning Reminders">
          <Suspense fallback={<WidgetCardSkeleton id="cleaning-section" titleWidth="w-40" rows={3} />}>
            <CleaningCard />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "contacts-section",
      node: (
        <SectionErrorBoundary key="contacts-section" label="Contacts">
          <Suspense fallback={<WidgetCardSkeleton id="contacts-section" titleWidth="w-48" rows={3} />}>
            <ContactsCard />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "meal-plan-section",
      node: (
        <SectionErrorBoundary key="meal-plan-section" label="Meal Planning & Grocery List">
          <Suspense fallback={<MealPlanGroceryCardSkeleton />}>
            <MealPlanGroceryCard />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "journal-section",
      node: (
        <SectionErrorBoundary key="journal-section" label="Journal">
          <Suspense fallback={<JournalCardSkeleton id="journal-section" />}>
            <JournalCardLoader />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "health-section",
      node: (
        <SectionErrorBoundary key="health-section" label="Health">
          <Suspense fallback={<HealthCardSkeleton />}>
            <HealthCard error={whoopError} errorDetail={whoopErrorDetail} />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
    {
      id: "workout-section",
      node: (
        <SectionErrorBoundary key="workout-section" label="Weight Training">
          <Suspense fallback={<WorkoutCardSkeleton id="workout-section" />}>
            <WorkoutCardLoader />
          </Suspense>
        </SectionErrorBoundary>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <Header />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-5 px-6 py-8 sm:grid-cols-2 lg:grid-cols-3">
        <SectionOrderBoard sections={sections} initialOrder={sectionOrder} />
      </main>
      <NavRail />
    </div>
  );
}
