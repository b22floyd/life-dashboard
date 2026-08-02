import { Header } from "@/components/dashboard/Header";
import { TasksCard } from "@/components/dashboard/TasksCard";
import { HabitsCard } from "@/components/dashboard/HabitsCard";
import { EventsCard } from "@/components/dashboard/EventsCard";
import { FinanceCard } from "@/components/dashboard/FinanceCard";
import { JournalCard } from "@/components/dashboard/JournalCard";
import { WorkoutCard } from "@/components/dashboard/WorkoutCard";
import { getJournalEntries } from "@/lib/journal";
import { getWorkoutSessions } from "@/lib/workouts";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ google_error?: string }>;
}) {
  const [{ google_error: googleError }, journalEntries, workoutSessions] = await Promise.all([
    searchParams,
    getJournalEntries(),
    getWorkoutSessions(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <Header />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-5 px-6 py-8 sm:grid-cols-2 lg:grid-cols-3">
        <TasksCard />
        <EventsCard error={googleError} />
        <HabitsCard />
        <FinanceCard />
        <JournalCard entries={journalEntries} />
        <WorkoutCard sessions={workoutSessions} />
      </main>
    </div>
  );
}
