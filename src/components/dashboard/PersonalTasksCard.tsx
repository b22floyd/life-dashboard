import { getPersonalTasks } from "@/lib/personal-tasks";
import { PersonalTasksCardBody } from "./PersonalTasksCardBody";
import { SectionLoadError } from "./SectionLoadError";
import { WidgetCard } from "./WidgetCard";

export async function PersonalTasksCard() {
  const tasks = await getPersonalTasks();

  return (
    <WidgetCard title="Personal Tasks" id="personal-tasks-section">
      {tasks === null ? (
        <SectionLoadError message="Couldn't load your personal tasks right now." />
      ) : (
        <PersonalTasksCardBody tasks={tasks} />
      )}
    </WidgetCard>
  );
}
