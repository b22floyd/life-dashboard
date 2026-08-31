import { z } from "zod";
import { CLEANING_FREQUENCIES } from "./cleaning-utils";
import { CONTACT_CATEGORIES } from "./contacts-utils";
import { DAYS_OF_WEEK, MEAL_MODES, MEAL_SLOTS } from "./meal-plan-utils";
import { WORKOUT_CATEGORIES } from "./workout-utils";
import { DATA_EXPORT_VERSION } from "./export";

// Mirrors export.ts's row shapes exactly — this is the read side of the same
// contract, so a backup this app just produced always validates cleanly.
// Deliberately loose on exact date/instant formatting (a non-empty string)
// rather than strict ISO parsing: the goal is to catch a wrong/corrupted
// file before any database write, not to re-validate every date the way
// each feature's own actions already do.
const nonEmptyString = z.string().min(1);
const idString = z.string().min(1);

const journalEntrySchema = z.object({
  id: idString,
  entry_date: nonEmptyString,
  content: z.string(),
  created_at: nonEmptyString,
});

const exerciseSetSchema = z.object({
  id: idString,
  set_number: z.number().int(),
  weight: z.number(),
  reps: z.number(),
  notes: z.string().nullable(),
  created_at: nonEmptyString,
});

const sessionExerciseSchema = z.object({
  id: idString,
  exercise_name: nonEmptyString,
  position: z.number().int(),
  created_at: nonEmptyString,
  sets: z.array(exerciseSetSchema),
});

const workoutSessionSchema = z.object({
  id: idString,
  session_date: nonEmptyString,
  name: z.string().nullable(),
  category: z.enum(WORKOUT_CATEGORIES).nullable(),
  created_at: nonEmptyString,
  exercises: z.array(sessionExerciseSchema),
});

const habitCompletionSchema = z.object({
  id: idString,
  completed_date: nonEmptyString,
  created_at: nonEmptyString,
});

const habitSchema = z.object({
  id: idString,
  name: nonEmptyString,
  position: z.number().int(),
  created_at: nonEmptyString,
  completions: z.array(habitCompletionSchema),
});

const mealPlanEntrySchema = z.object({
  id: idString,
  week_start_date: nonEmptyString,
  day_of_week: z.enum(DAYS_OF_WEEK),
  meal_slot: z.enum(MEAL_SLOTS),
  mode: z.enum(MEAL_MODES),
  content: z.string(),
  leftover_day_of_week: z.enum(DAYS_OF_WEEK).nullable(),
  leftover_meal_slot: z.enum(MEAL_SLOTS).nullable(),
  updated_at: nonEmptyString,
});

const groceryItemSchema = z.object({
  id: idString,
  content: nonEmptyString,
  checked: z.boolean(),
  created_at: nonEmptyString,
});

const groceryStapleSchema = z.object({
  id: idString,
  content: nonEmptyString,
  created_at: nonEmptyString,
});

const cleaningTaskCompletionSchema = z.object({
  id: idString,
  completed_at: nonEmptyString,
});

const cleaningTaskSchema = z.object({
  id: idString,
  name: nonEmptyString,
  frequency: z.enum(CLEANING_FREQUENCIES),
  created_at: nonEmptyString,
  completions: z.array(cleaningTaskCompletionSchema),
});

const goalCheckpointSchema = z.object({
  id: idString,
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  target_description: z.string(),
  completed: z.boolean(),
  completed_at: z.string().nullable(),
});

const goalCheckinNoteSchema = z.object({
  id: idString,
  note: nonEmptyString,
  created_at: nonEmptyString,
});

const annualGoalSchema = z.object({
  id: idString,
  title: nonEmptyString,
  description: z.string(),
  position: z.number().int(),
  created_at: nonEmptyString,
  checkpoints: z.array(goalCheckpointSchema),
  checkin_notes: z.array(goalCheckinNoteSchema),
});

const contactLogSchema = z.object({
  id: idString,
  contacted_at: nonEmptyString,
});

const contactSchema = z.object({
  id: idString,
  name: nonEmptyString,
  category: z.enum(CONTACT_CATEGORIES),
  birthday: z.string().nullable(),
  important_date: z.string().nullable(),
  important_date_label: z.string(),
  notes: z.string(),
  gift_ideas: z.string(),
  cadence_days: z.number().int().positive(),
  created_at: nonEmptyString,
  log: z.array(contactLogSchema),
});

const weightGoalSchema = z.object({
  goal_weight: z.number(),
  target_date: z.string().nullable(),
  updated_at: nonEmptyString,
});

const weightEntrySchema = z.object({
  id: idString,
  entry_date: nonEmptyString,
  weight: z.number(),
  created_at: nonEmptyString,
});

const personalTaskSchema = z.object({
  id: idString,
  content: nonEmptyString,
  created_at: nonEmptyString,
});

// One schema per DataExport top-level key. Each is the payload shape a
// restore action for that section expects — not the row shape alone, since
// several sections bundle more than one table (grocery: items + staples;
// weightTracker: goal + entries).
export const SECTION_SCHEMAS = {
  journal: z.object({ entries: z.array(journalEntrySchema) }),
  workouts: z.object({ sessions: z.array(workoutSessionSchema) }),
  habits: z.object({ habits: z.array(habitSchema) }),
  mealPlan: z.object({ entries: z.array(mealPlanEntrySchema) }),
  grocery: z.object({ items: z.array(groceryItemSchema), staples: z.array(groceryStapleSchema) }),
  cleaning: z.object({ tasks: z.array(cleaningTaskSchema) }),
  annualGoals: z.object({ goals: z.array(annualGoalSchema) }),
  contacts: z.object({ contacts: z.array(contactSchema) }),
  weightTracker: z.object({ goal: weightGoalSchema.nullable(), entries: z.array(weightEntrySchema) }),
  personalTasks: z.object({ tasks: z.array(personalTaskSchema) }),
} as const;

export const RESTORABLE_SECTIONS = Object.keys(SECTION_SCHEMAS) as RestorableSection[];
export type RestorableSection = keyof typeof SECTION_SCHEMAS;

export const SECTION_LABELS: Record<RestorableSection, string> = {
  journal: "Journal",
  workouts: "Weight Training",
  habits: "Habit Streaks",
  mealPlan: "Meal Plan",
  grocery: "Grocery List & Staples",
  cleaning: "Routine Cleaning Reminders",
  annualGoals: "Annual Goals",
  contacts: "Contacts",
  weightTracker: "Weight Tracker",
  personalTasks: "Personal Tasks",
};

// Every restorable section replaces what's currently there with the
// backup's contents. Most sections have no natural real-world uniqueness
// constraint on their rows, so "replace" there means delete every existing
// row for the user, then insert the backup's rows verbatim (same ids,
// preserving the nested parent/child structure a fresh insert would
// otherwise have to re-link). mealPlan's entries and the weight goal are
// different: those tables were deliberately built to be upserted onto a
// natural key and never deleted (see their own migrations, and there's
// accordingly no delete RLS policy on either) — restoring them upserts the
// backup's rows onto that same key instead, so the backup's values win for
// any slot/goal it contains, but anything you've added since that isn't in
// the backup is left alone rather than removed. Shown as a caveat in the UI
// before restoring either section.
export const SECTION_CAVEATS: Partial<Record<RestorableSection, string>> = {
  mealPlan:
    "This overwrites matching week/day/meal entries from the backup, but won't remove any meal plan entries you've added since that aren't in the backup (this table is designed to only ever be added to or updated, never deleted from).",
  weightTracker:
    "Weight entries are fully replaced. The weight goal is only overwritten if the backup has one — a backup with no goal saved won't clear an existing one (this table has no delete capability).",
  personalTasks:
    "Due dates aren't currently included in exports, so restored personal tasks will come back without their due dates even if they had one when exported.",
};

// A short, human-readable count for the "what's in this section" summary
// shown before restoring — e.g. "3 sessions, 14 exercises, 37 sets".
const SUMMARY_PARSE_FAILURE = "Couldn't read this section from the file.";

export function summarizeSection(section: RestorableSection, data: unknown): string {
  // Each branch parses with its own concrete schema (SECTION_SCHEMAS.journal,
  // not the indexed SECTION_SCHEMAS[section]) so TypeScript can narrow
  // result.data to that section's specific shape — an indexed lookup keyed
  // by the general RestorableSection type would only ever type result.data
  // as the union of every section's shape, unnarrowed by this switch.
  switch (section) {
    case "journal": {
      const result = SECTION_SCHEMAS.journal.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      return pluralize(result.data.entries.length, "entry", "entries");
    }
    case "workouts": {
      const result = SECTION_SCHEMAS.workouts.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      const sessions = result.data.sessions;
      const exercises = sessions.reduce((sum, s) => sum + s.exercises.length, 0);
      const sets = sessions.reduce(
        (sum, s) => sum + s.exercises.reduce((esum, e) => esum + e.sets.length, 0),
        0,
      );
      return `${pluralize(sessions.length, "session")}, ${pluralize(exercises, "exercise")}, ${pluralize(sets, "set")}`;
    }
    case "habits": {
      const result = SECTION_SCHEMAS.habits.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      const habits = result.data.habits;
      const completions = habits.reduce((sum, h) => sum + h.completions.length, 0);
      return `${pluralize(habits.length, "habit")}, ${pluralize(completions, "completion")}`;
    }
    case "mealPlan": {
      const result = SECTION_SCHEMAS.mealPlan.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      return pluralize(result.data.entries.length, "entry", "entries");
    }
    case "grocery": {
      const result = SECTION_SCHEMAS.grocery.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      return `${pluralize(result.data.items.length, "item")}, ${pluralize(result.data.staples.length, "staple")}`;
    }
    case "cleaning": {
      const result = SECTION_SCHEMAS.cleaning.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      const tasks = result.data.tasks;
      const completions = tasks.reduce((sum, t) => sum + t.completions.length, 0);
      return `${pluralize(tasks.length, "task")}, ${pluralize(completions, "completion")}`;
    }
    case "annualGoals": {
      const result = SECTION_SCHEMAS.annualGoals.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      return pluralize(result.data.goals.length, "goal");
    }
    case "contacts": {
      const result = SECTION_SCHEMAS.contacts.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      return pluralize(result.data.contacts.length, "contact");
    }
    case "weightTracker": {
      const result = SECTION_SCHEMAS.weightTracker.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      const hasGoal = result.data.goal ? "a goal" : "no goal";
      return `${hasGoal}, ${pluralize(result.data.entries.length, "entry", "entries")}`;
    }
    case "personalTasks": {
      const result = SECTION_SCHEMAS.personalTasks.safeParse(data);
      if (!result.success) return SUMMARY_PARSE_FAILURE;
      return pluralize(result.data.tasks.length, "task");
    }
  }
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export type ParsedBackupFile = { version: number; exportedAt: string; raw: Record<string, unknown> };

// Only checks the file's outer shape (version + exportedAt) — each section
// is validated separately, on demand, right before that specific section is
// restored. A plain runtime check rather than a zod object schema here,
// since the only thing that matters at this stage is "is this recognizably
// a life-dashboard backup, and is its version one this app understands" —
// the 10 section keys themselves are validated per-section regardless.
export function parseBackupFile(json: unknown): { data: ParsedBackupFile } | { error: string } {
  if (typeof json !== "object" || json === null) {
    return { error: "This doesn't look like a life-dashboard backup file." };
  }
  const obj = json as Record<string, unknown>;
  if (typeof obj.version !== "number" || typeof obj.exportedAt !== "string") {
    return { error: "This doesn't look like a life-dashboard backup file." };
  }
  if (obj.version !== DATA_EXPORT_VERSION) {
    return {
      error: `This backup was made with a different export format (v${obj.version}, expected v${DATA_EXPORT_VERSION}) and can't be restored.`,
    };
  }
  return { data: { version: obj.version, exportedAt: obj.exportedAt, raw: obj } };
}
