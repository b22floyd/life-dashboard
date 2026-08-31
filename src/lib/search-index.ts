import { getCleaningTasks } from "@/lib/cleaning";
import { getContacts } from "@/lib/contacts";
import { getAnnualGoals } from "@/lib/goals";
import { getGroceryItems, getGroceryStaples } from "@/lib/grocery";
import { getHabits } from "@/lib/habits";
import { getJournalEntries } from "@/lib/journal";
import { getPersonalTasks } from "@/lib/personal-tasks";
import { truncateForLabel, type SearchItem } from "@/lib/search-utils";
import { getSelectedProjectIds, getTodoistTasksForProjects } from "@/lib/todoist";
import { getWorkoutSessions } from "@/lib/workouts";

// Aggregates searchable text from across the dashboard, the same way
// daily-glance.ts already aggregates a summary view — reusing every
// feature's own getX() data layer rather than querying tables directly, at
// the cost of a second round of the same queries (and a second live
// Todoist call) on every page load. Accepted here for the same reason
// daily-glance.ts accepts it: this is a single-user personal dashboard, not
// a high-traffic system, so a straightforward reuse of existing data
// layers is worth far more than the marginal fetch cost it duplicates.
//
// Only the sections with meaningful free-text content are indexed —
// Events/Weather/Health aren't, since there's nothing there a text search
// would usefully match beyond what's already visible at a glance. A
// failed fetch (null) for any one section just contributes nothing to the
// index rather than breaking the whole search, mirroring how every other
// summary/aggregation in this app treats a null the same way.
export async function getSearchIndex(): Promise<SearchItem[]> {
  const selectedProjectIds = await getSelectedProjectIds();

  const [
    cleaningTasks,
    contacts,
    goals,
    groceryItems,
    groceryStaples,
    habits,
    journalEntries,
    personalTasks,
    workTasks,
    workoutSessions,
  ] = await Promise.all([
    getCleaningTasks(),
    getContacts(),
    getAnnualGoals(),
    getGroceryItems(),
    getGroceryStaples(),
    getHabits(),
    getJournalEntries(),
    getPersonalTasks(),
    selectedProjectIds.length > 0 ? getTodoistTasksForProjects(selectedProjectIds) : Promise.resolve([]),
    getWorkoutSessions(),
  ]);

  const items: SearchItem[] = [];

  for (const task of personalTasks ?? []) {
    items.push({
      id: `personal-task-${task.id}`,
      category: "Personal Tasks",
      label: task.content,
      sectionId: "personal-tasks-section",
    });
  }

  for (const task of workTasks ?? []) {
    items.push({
      id: `work-task-${task.id}`,
      category: "Work Tasks",
      label: task.content,
      sectionId: "work-tasks-section",
    });
  }

  for (const habit of habits ?? []) {
    items.push({
      id: `habit-${habit.id}`,
      category: "Habit Streaks",
      label: habit.name,
      sectionId: "habits-section",
    });
  }

  for (const goal of goals ?? []) {
    items.push({
      id: `goal-${goal.id}`,
      category: "Annual Goals",
      label: goal.title,
      secondary: [goal.description, ...goal.notes.map((note) => note.note)].join(" "),
      sectionId: "annual-goals-section",
    });
  }

  for (const task of cleaningTasks ?? []) {
    items.push({
      id: `cleaning-${task.id}`,
      category: "Routine Cleaning Reminders",
      label: task.name,
      sectionId: "cleaning-section",
    });
  }

  for (const contact of contacts ?? []) {
    items.push({
      id: `contact-${contact.id}`,
      category: "Contacts",
      label: contact.name,
      secondary: [contact.notes, contact.giftIdeas, contact.importantDateLabel].join(" "),
      sectionId: "contacts-section",
    });
  }

  for (const item of groceryItems ?? []) {
    items.push({
      id: `grocery-item-${item.id}`,
      category: "Grocery List",
      label: item.content,
      sectionId: "meal-plan-section",
    });
  }
  for (const staple of groceryStaples ?? []) {
    items.push({
      id: `grocery-staple-${staple.id}`,
      category: "Grocery List",
      label: staple.content,
      sectionId: "meal-plan-section",
    });
  }

  for (const entry of journalEntries ?? []) {
    items.push({
      id: `journal-${entry.id}`,
      category: "Journal",
      label: truncateForLabel(entry.content),
      secondary: entry.content,
      sectionId: "journal-section",
    });
  }

  for (const session of workoutSessions ?? []) {
    const exerciseNames = session.exercises.map((exercise) => exercise.exercise_name).join(" ");
    items.push({
      id: `workout-${session.id}`,
      category: "Weight Training",
      label: session.name ?? `Workout — ${session.session_date}`,
      secondary: exerciseNames,
      sectionId: "workout-section",
    });
  }

  return items;
}
