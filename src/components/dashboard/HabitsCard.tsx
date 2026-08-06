import { getHabits } from "@/lib/habits";
import { HabitsCardBody } from "./HabitsCardBody";
import { SectionLoadError } from "./SectionLoadError";
import { WidgetCard } from "./WidgetCard";

export async function HabitsCard() {
  const habits = await getHabits();

  return (
    <WidgetCard title="Habit Streaks" id="habits-section">
      {habits === null ? (
        <SectionLoadError message="Couldn't load your habits right now." />
      ) : (
        <HabitsCardBody habits={habits} />
      )}
    </WidgetCard>
  );
}
