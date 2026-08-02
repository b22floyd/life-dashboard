import { Header } from "@/components/dashboard/Header";
import { TasksCard } from "@/components/dashboard/TasksCard";
import { HabitsCard } from "@/components/dashboard/HabitsCard";
import { EventsCard } from "@/components/dashboard/EventsCard";
import { NotesCard } from "@/components/dashboard/NotesCard";
import { FinanceCard } from "@/components/dashboard/FinanceCard";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <Header />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-5 px-6 py-8 sm:grid-cols-2 lg:grid-cols-3">
        <TasksCard />
        <EventsCard />
        <HabitsCard />
        <FinanceCard />
        <NotesCard />
      </main>
    </div>
  );
}
