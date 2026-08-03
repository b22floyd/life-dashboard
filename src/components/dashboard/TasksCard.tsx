import {
  getSelectedProjectIds,
  getTodoistProjects,
  getTodoistTasksForProjects,
} from "@/lib/todoist";
import { TasksCardBody } from "./TasksCardBody";
import { WidgetCard } from "./WidgetCard";

export async function TasksCard() {
  const selectedProjectIds = await getSelectedProjectIds();
  const [projects, tasks] = await Promise.all([
    getTodoistProjects(),
    selectedProjectIds.length > 0
      ? getTodoistTasksForProjects(selectedProjectIds)
      : Promise.resolve([]),
  ]);

  return (
    <WidgetCard title="Work Tasks">
      <TasksCardBody
        projects={projects}
        selectedProjectIds={selectedProjectIds}
        tasks={tasks}
      />
    </WidgetCard>
  );
}
