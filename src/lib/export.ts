import type { SupabaseClient } from "@supabase/supabase-js";

// Unlike every other data-layer file in this app (getHabits, getContacts,
// etc.), this one takes an already-constructed client and an explicit
// user id instead of calling createClient() itself. It has to run in two
// very different contexts: the manual export route (a cookie-bound,
// RLS-scoped client from a signed-in request) and the weekly backup cron
// (a service-role client with no session at all, which bypasses RLS
// entirely). The explicit `.eq("user_id", userId)` filter on every
// top-level query is what actually scopes the data in the cron case —
// RLS isn't there to fall back on — so it's applied uniformly in both.

export const DATA_EXPORT_VERSION = 1;

export type DataExport = {
  version: typeof DATA_EXPORT_VERSION;
  exportedAt: string;
  journal: { entries: JournalEntryRow[] };
  workouts: { sessions: WorkoutSessionRow[] };
  habits: { habits: HabitRow[] };
  mealPlan: { entries: MealPlanEntryRow[] };
  grocery: { items: GroceryItemRow[]; staples: GroceryStapleRow[] };
  cleaning: { tasks: CleaningTaskRow[] };
  annualGoals: { goals: AnnualGoalRow[] };
  contacts: { contacts: ContactRow[] };
  weightTracker: { goal: WeightGoalRow | null; entries: WeightEntryRow[] };
  personalTasks: { tasks: PersonalTaskRow[] };
};

type JournalEntryRow = {
  id: string;
  entry_date: string;
  content: string;
  created_at: string;
};

type ExerciseSetRow = {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  notes: string | null;
  created_at: string;
};

type SessionExerciseRow = {
  id: string;
  exercise_name: string;
  position: number;
  created_at: string;
  sets: ExerciseSetRow[];
};

type WorkoutSessionRow = {
  id: string;
  session_date: string;
  name: string | null;
  category: string | null;
  created_at: string;
  exercises: SessionExerciseRow[];
};

type HabitCompletionRow = { id: string; completed_date: string; created_at: string };

type HabitRow = {
  id: string;
  name: string;
  position: number;
  created_at: string;
  completions: HabitCompletionRow[];
};

type MealPlanEntryRow = {
  id: string;
  week_start_date: string;
  day_of_week: string;
  meal_slot: string;
  mode: string;
  content: string;
  leftover_day_of_week: string | null;
  leftover_meal_slot: string | null;
  updated_at: string;
};

type GroceryItemRow = { id: string; content: string; checked: boolean; created_at: string };
type GroceryStapleRow = { id: string; content: string; created_at: string };

type CleaningTaskCompletionRow = { id: string; completed_at: string };

type CleaningTaskRow = {
  id: string;
  name: string;
  frequency: string;
  created_at: string;
  completions: CleaningTaskCompletionRow[];
};

type GoalCheckpointRow = {
  id: string;
  quarter: string;
  target_description: string;
  completed: boolean;
  completed_at: string | null;
};

type GoalCheckinNoteRow = { id: string; note: string; created_at: string };

type AnnualGoalRow = {
  id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  checkpoints: GoalCheckpointRow[];
  checkin_notes: GoalCheckinNoteRow[];
};

type ContactLogRow = { id: string; contacted_at: string };

type ContactRow = {
  id: string;
  name: string;
  category: string;
  birthday: string | null;
  important_date: string | null;
  important_date_label: string;
  notes: string;
  gift_ideas: string;
  cadence_days: number;
  created_at: string;
  log: ContactLogRow[];
};

type WeightGoalRow = { goal_weight: number; target_date: string | null; updated_at: string };
type WeightEntryRow = { id: string; entry_date: string; weight: number; created_at: string };

type PersonalTaskRow = { id: string; content: string; created_at: string };

function fail(section: string, error: { message: string }): never {
  throw new Error(`Failed to export ${section}: ${error.message}`);
}

export async function buildDataExport(
  supabase: SupabaseClient,
  userId: string,
): Promise<DataExport> {
  const [
    journalRes,
    workoutsRes,
    habitsRes,
    mealPlanRes,
    groceryItemsRes,
    groceryStaplesRes,
    cleaningRes,
    goalsRes,
    contactsRes,
    weightGoalRes,
    weightEntriesRes,
    personalTasksRes,
  ] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, entry_date, content, created_at")
      .eq("user_id", userId)
      .order("entry_date", { ascending: true }),
    supabase
      .from("workout_sessions")
      .select(
        `id, session_date, name, category, created_at,
         session_exercises (id, exercise_name, position, created_at,
           exercise_sets (id, set_number, weight, reps, notes, created_at))`,
      )
      .eq("user_id", userId)
      .order("session_date", { ascending: true }),
    supabase
      .from("habits")
      .select("id, name, position, created_at, daily_habit_completions (id, completed_date, created_at)")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabase
      .from("meal_plan_entries")
      .select(
        "id, week_start_date, day_of_week, meal_slot, mode, content, leftover_day_of_week, leftover_meal_slot, updated_at",
      )
      .eq("user_id", userId)
      .order("week_start_date", { ascending: true }),
    supabase
      .from("grocery_items")
      .select("id, content, checked, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("grocery_staples")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("cleaning_tasks")
      .select("id, name, frequency, created_at, cleaning_task_completions (id, completed_at)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("annual_goals")
      .select(
        `id, title, description, position, created_at,
         goal_checkpoints (id, quarter, target_description, completed, completed_at),
         goal_checkin_notes (id, note, created_at)`,
      )
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabase
      .from("contacts")
      .select(
        `id, name, category, birthday, important_date, important_date_label, notes, gift_ideas, cadence_days, created_at,
         contact_log (id, contacted_at)`,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("weight_goal").select("goal_weight, target_date, updated_at").eq("user_id", userId).maybeSingle(),
    supabase
      .from("weight_entries")
      .select("id, entry_date, weight, created_at")
      .eq("user_id", userId)
      .order("entry_date", { ascending: true }),
    supabase
      .from("personal_tasks")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  if (journalRes.error) fail("journal entries", journalRes.error);
  if (workoutsRes.error) fail("workout sessions", workoutsRes.error);
  if (habitsRes.error) fail("habits", habitsRes.error);
  if (mealPlanRes.error) fail("meal plan", mealPlanRes.error);
  if (groceryItemsRes.error) fail("grocery items", groceryItemsRes.error);
  if (groceryStaplesRes.error) fail("grocery staples", groceryStaplesRes.error);
  if (cleaningRes.error) fail("cleaning tasks", cleaningRes.error);
  if (goalsRes.error) fail("annual goals", goalsRes.error);
  if (contactsRes.error) fail("contacts", contactsRes.error);
  if (weightGoalRes.error) fail("weight goal", weightGoalRes.error);
  if (weightEntriesRes.error) fail("weight entries", weightEntriesRes.error);
  if (personalTasksRes.error) fail("personal tasks", personalTasksRes.error);

  type RawWorkoutSession = Omit<WorkoutSessionRow, "exercises"> & {
    session_exercises: (Omit<SessionExerciseRow, "sets"> & {
      exercise_sets: ExerciseSetRow[] | null;
    })[] | null;
  };

  const workouts: WorkoutSessionRow[] = ((workoutsRes.data ?? []) as RawWorkoutSession[]).map(
    (session) => ({
      id: session.id,
      session_date: session.session_date,
      name: session.name,
      category: session.category,
      created_at: session.created_at,
      exercises: (session.session_exercises ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((exercise) => ({
          id: exercise.id,
          exercise_name: exercise.exercise_name,
          position: exercise.position,
          created_at: exercise.created_at,
          sets: (exercise.exercise_sets ?? []).slice().sort((a, b) => a.set_number - b.set_number),
        })),
    }),
  );

  type RawHabit = Omit<HabitRow, "completions"> & {
    daily_habit_completions: HabitCompletionRow[] | null;
  };

  const habits: HabitRow[] = ((habitsRes.data ?? []) as RawHabit[]).map((habit) => ({
    id: habit.id,
    name: habit.name,
    position: habit.position,
    created_at: habit.created_at,
    completions: (habit.daily_habit_completions ?? [])
      .slice()
      .sort((a, b) => a.completed_date.localeCompare(b.completed_date)),
  }));

  type RawCleaningTask = Omit<CleaningTaskRow, "completions"> & {
    cleaning_task_completions: CleaningTaskCompletionRow[] | null;
  };

  const cleaning: CleaningTaskRow[] = ((cleaningRes.data ?? []) as RawCleaningTask[]).map(
    (task) => ({
      id: task.id,
      name: task.name,
      frequency: task.frequency,
      created_at: task.created_at,
      completions: (task.cleaning_task_completions ?? [])
        .slice()
        .sort((a, b) => a.completed_at.localeCompare(b.completed_at)),
    }),
  );

  type RawAnnualGoal = Omit<AnnualGoalRow, "checkpoints" | "checkin_notes"> & {
    goal_checkpoints: GoalCheckpointRow[] | null;
    goal_checkin_notes: GoalCheckinNoteRow[] | null;
  };

  const annualGoals: AnnualGoalRow[] = ((goalsRes.data ?? []) as RawAnnualGoal[]).map((goal) => ({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    position: goal.position,
    created_at: goal.created_at,
    checkpoints: goal.goal_checkpoints ?? [],
    checkin_notes: (goal.goal_checkin_notes ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));

  type RawContact = Omit<ContactRow, "log"> & { contact_log: ContactLogRow[] | null };

  const contacts: ContactRow[] = ((contactsRes.data ?? []) as RawContact[]).map((contact) => ({
    id: contact.id,
    name: contact.name,
    category: contact.category,
    birthday: contact.birthday,
    important_date: contact.important_date,
    important_date_label: contact.important_date_label,
    notes: contact.notes,
    gift_ideas: contact.gift_ideas,
    cadence_days: contact.cadence_days,
    created_at: contact.created_at,
    log: (contact.contact_log ?? []).slice().sort((a, b) => a.contacted_at.localeCompare(b.contacted_at)),
  }));

  return {
    version: DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    journal: { entries: (journalRes.data ?? []) as JournalEntryRow[] },
    workouts: { sessions: workouts },
    habits: { habits },
    mealPlan: { entries: (mealPlanRes.data ?? []) as MealPlanEntryRow[] },
    grocery: {
      items: (groceryItemsRes.data ?? []) as GroceryItemRow[],
      staples: (groceryStaplesRes.data ?? []) as GroceryStapleRow[],
    },
    cleaning: { tasks: cleaning },
    annualGoals: { goals: annualGoals },
    contacts: { contacts },
    weightTracker: {
      goal: (weightGoalRes.data ?? null) as WeightGoalRow | null,
      entries: (weightEntriesRes.data ?? []) as WeightEntryRow[],
    },
    personalTasks: { tasks: (personalTasksRes.data ?? []) as PersonalTaskRow[] },
  };
}
