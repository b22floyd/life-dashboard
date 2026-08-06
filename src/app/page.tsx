import { Suspense } from "react";
import { getSectionOrder } from "@/lib/dashboard-section-order";
import { resolveSectionOrder } from "@/lib/dashboard-sections";
import { SectionOrderBoard } from "@/components/dashboard/SectionOrderBoard";
import { Header } from "@/components/dashboard/Header";
import { PersonalTasksCard } from "@/components/dashboard/PersonalTasksCard";
import { TasksCard } from "@/components/dashboard/TasksCard";
import { HabitsCard } from "@/components/dashboard/HabitsCard";
import { AnnualGoalsCard } from "@/components/dashboard/AnnualGoalsCard";
import { CleaningCard } from "@/components/dashboard/CleaningCard";
import { ContactsCard } from "@/components/dashboard/ContactsCard";
import { MealPlanGroceryCard } from "@/components/dashboard/MealPlanGroceryCard";
import { EventsCard } from "@/components/dashboard/EventsCard";
import { MonarchCard } from "@/components/dashboard/MonarchCard";
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
  const {
    google_error: googleError,
    google_error_detail: googleErrorDetail,
    whoop_error: whoopError,
    whoop_error_detail: whoopErrorDetail,
  } = await searchParams;

  const savedOrder = await getSectionOrder();
  const sectionOrder = resolveSectionOrder(savedOrder);

  const sections = [
    {
      id: "personal-tasks-section",
      node: (
        <Suspense
          key="personal-tasks-section"
          fallback={<WidgetCardSkeleton id="personal-tasks-section" titleWidth="w-28" rows={4} />}
        >
          <PersonalTasksCard />
        </Suspense>
      ),
    },
    {
      id: "work-tasks-section",
      node: (
        <Suspense
          key="work-tasks-section"
          fallback={<TabbedListCardSkeleton id="work-tasks-section" titleWidth="w-24" />}
        >
          <TasksCard />
        </Suspense>
      ),
    },
    {
      id: "events-section",
      node: (
        <Suspense
          key="events-section"
          fallback={<TabbedListCardSkeleton id="events-section" titleWidth="w-32" />}
        >
          <EventsCard error={googleError} errorDetail={googleErrorDetail} />
        </Suspense>
      ),
    },
    {
      id: "habits-section",
      node: (
        <Suspense
          key="habits-section"
          fallback={<WidgetCardSkeleton id="habits-section" titleWidth="w-28" rows={5} />}
        >
          <HabitsCard />
        </Suspense>
      ),
    },
    {
      id: "annual-goals-section",
      node: (
        <Suspense
          key="annual-goals-section"
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
      ),
    },
    {
      id: "cleaning-section",
      node: (
        <Suspense
          key="cleaning-section"
          fallback={<WidgetCardSkeleton id="cleaning-section" titleWidth="w-40" rows={3} />}
        >
          <CleaningCard />
        </Suspense>
      ),
    },
    {
      id: "contacts-section",
      node: (
        <Suspense
          key="contacts-section"
          fallback={<WidgetCardSkeleton id="contacts-section" titleWidth="w-48" rows={3} />}
        >
          <ContactsCard />
        </Suspense>
      ),
    },
    {
      id: "meal-plan-section",
      node: (
        <Suspense key="meal-plan-section" fallback={<MealPlanGroceryCardSkeleton />}>
          <MealPlanGroceryCard />
        </Suspense>
      ),
    },
    { id: "monarch-section", node: <MonarchCard key="monarch-section" /> },
    {
      id: "journal-section",
      node: (
        <Suspense key="journal-section" fallback={<JournalCardSkeleton id="journal-section" />}>
          <JournalCardLoader />
        </Suspense>
      ),
    },
    {
      id: "health-section",
      node: (
        <Suspense key="health-section" fallback={<HealthCardSkeleton />}>
          <HealthCard error={whoopError} errorDetail={whoopErrorDetail} />
        </Suspense>
      ),
    },
    {
      id: "workout-section",
      node: (
        <Suspense key="workout-section" fallback={<WorkoutCardSkeleton id="workout-section" />}>
          <WorkoutCardLoader />
        </Suspense>
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
