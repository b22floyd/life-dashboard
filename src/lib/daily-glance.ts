import { getLocalDateString } from "@/lib/date-utils";
import { getCleaningTasks } from "@/lib/cleaning";
import type { CleaningTaskWithStatus } from "@/lib/cleaning-utils";
import { getContacts } from "@/lib/contacts";
import type { ContactWithStatus } from "@/lib/contacts-utils";
import { getUpcomingEvents } from "@/lib/google-calendar";
import type { CalendarEvent } from "@/lib/google-calendar-utils";
import { getHabits } from "@/lib/habits";
import type { HabitWithCompletions } from "@/lib/habit-utils";
import { getMealPlanForWeek } from "@/lib/meal-plan";
import { getWeekStartDate, type MealPlanEntry } from "@/lib/meal-plan-utils";
import { getPersonalTasks, type PersonalTask } from "@/lib/personal-tasks";
import { getSelectedProjectIds, getTodoistTasksForProjects, type TodoistTask } from "@/lib/todoist";
import { getWeightEntries, getWeightGoal } from "@/lib/weight";
import type { WeightEntry, WeightGoal } from "@/lib/weight-utils";
import { getHealthSnapshot, isWhoopConnected } from "@/lib/whoop";
import type { HealthSnapshot } from "@/lib/whoop-utils";

export type DailyGlanceData = {
  habits: HabitWithCompletions[];
  cleaningTasks: CleaningTaskWithStatus[];
  contacts: ContactWithStatus[];
  personalTasks: PersonalTask[];
  workTasks: TodoistTask[] | null;
  events: CalendarEvent[] | null;
  mealPlanEntries: MealPlanEntry[];
  weightEntries: WeightEntry[];
  weightGoal: WeightGoal;
  healthSnapshot: HealthSnapshot | null;
};

// Aggregates data this widget needs from across the dashboard's existing
// per-feature data layers, rather than querying tables directly — every
// other card already fetches (and correctly scopes/shapes) its own data,
// so this reuses the same getX() functions they call. The tradeoff is a
// second round of the same queries (and, worse, a second live call to
// Todoist/Google Calendar/Whoop) on every page load, since Header and
// <main> are sibling Server Components with no shared fetch cache here —
// acceptable for a single-user personal dashboard, not something worth a
// bigger data-fetching refactor across every existing card just for this.
//
// The meal plan section uses the server's best-guess "this week" (its
// effectively-UTC clock), same simplification MealPlanGroceryCard's own
// initial render already accepts, rather than adding this summary's own
// client-side week-correction round trip — a rare wrong-day mismatch right
// at a week boundary is an acceptable tradeoff for a convenience overview.
export async function getDailyGlanceData(): Promise<DailyGlanceData> {
  const weekStartDate = getWeekStartDate(getLocalDateString());
  const [selectedProjectIds, whoopConnected] = await Promise.all([
    getSelectedProjectIds(),
    isWhoopConnected(),
  ]);

  const [
    habits,
    cleaningTasks,
    contacts,
    personalTasks,
    workTasks,
    events,
    mealPlanEntries,
    weightEntries,
    weightGoal,
    healthResult,
  ] = await Promise.all([
    getHabits(),
    getCleaningTasks(),
    getContacts(),
    getPersonalTasks(),
    selectedProjectIds.length > 0
      ? getTodoistTasksForProjects(selectedProjectIds)
      : Promise.resolve([]),
    getUpcomingEvents(),
    getMealPlanForWeek(weekStartDate),
    getWeightEntries(),
    getWeightGoal(),
    whoopConnected ? getHealthSnapshot() : Promise.resolve(null),
  ]);
  const healthSnapshot = healthResult?.snapshot ?? null;

  // This summary already treats workTasks/events as "nothing to show" when
  // null (an external-service failure) rather than surfacing its own error
  // UI — the full error state belongs on the actual card the user interacts
  // with, not this convenience overview. The same `?? []` degradation now
  // applies to every other source here too, now that a Supabase error also
  // comes back as null instead of always silently reading as "empty."
  return {
    habits: habits ?? [],
    cleaningTasks: cleaningTasks ?? [],
    contacts: contacts ?? [],
    personalTasks: personalTasks ?? [],
    workTasks,
    events,
    mealPlanEntries: mealPlanEntries ?? [],
    weightEntries: weightEntries ?? [],
    weightGoal,
    healthSnapshot,
  };
}
