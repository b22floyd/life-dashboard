import { getCleaningTasks } from "@/lib/cleaning";
import { CleaningCardBody } from "./CleaningCardBody";
import { WidgetCard } from "./WidgetCard";

export async function CleaningCard() {
  const tasks = await getCleaningTasks();

  return (
    <WidgetCard title="Routine Cleaning Reminders" id="cleaning-section">
      <CleaningCardBody tasks={tasks} />
    </WidgetCard>
  );
}
