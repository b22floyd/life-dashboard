import { getCleaningTasks } from "@/lib/cleaning";
import { CleaningCardBody } from "./CleaningCardBody";
import { SectionLoadError } from "./SectionLoadError";
import { WidgetCard } from "./WidgetCard";

export async function CleaningCard() {
  const tasks = await getCleaningTasks();

  return (
    <WidgetCard title="Routine Cleaning Reminders" id="cleaning-section">
      {tasks === null ? (
        <SectionLoadError message="Couldn't load your cleaning reminders right now." />
      ) : (
        <CleaningCardBody tasks={tasks} />
      )}
    </WidgetCard>
  );
}
