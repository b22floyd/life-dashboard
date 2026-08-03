import { getHabits } from "@/lib/habits";
import { HabitsCardBody } from "./HabitsCardBody";
import { WidgetCard } from "./WidgetCard";

export async function HabitsCard() {
  const habits = await getHabits();

  return (
    <WidgetCard title="Habit Streaks">
      <HabitsCardBody habits={habits} />
    </WidgetCard>
  );
}
