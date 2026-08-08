import { getPersonalTasks } from "@/lib/personal-tasks";
import { PersonalTasksCardBody } from "./PersonalTasksCardBody";
import { WidgetCard } from "./WidgetCard";

export async function PersonalTasksCard() {
  const tasks = await getPersonalTasks();

  return (
    <WidgetCard title="Personal Tasks" id="personal-tasks-section">
      <PersonalTasksCardBody tasks={tasks} />
    </WidgetCard>
  );
}
