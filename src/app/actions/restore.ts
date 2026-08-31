"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RESTORABLE_SECTIONS, SECTION_SCHEMAS, type RestorableSection } from "@/lib/restore-utils";

export type RestoreResult = { success: true; message: string } | { error: string };

async function run<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

type Journal = z.infer<typeof SECTION_SCHEMAS.journal>;
type Workouts = z.infer<typeof SECTION_SCHEMAS.workouts>;
type Habits = z.infer<typeof SECTION_SCHEMAS.habits>;
type MealPlan = z.infer<typeof SECTION_SCHEMAS.mealPlan>;
type Grocery = z.infer<typeof SECTION_SCHEMAS.grocery>;
type Cleaning = z.infer<typeof SECTION_SCHEMAS.cleaning>;
type AnnualGoals = z.infer<typeof SECTION_SCHEMAS.annualGoals>;
type Contacts = z.infer<typeof SECTION_SCHEMAS.contacts>;
type WeightTracker = z.infer<typeof SECTION_SCHEMAS.weightTracker>;
type PersonalTasks = z.infer<typeof SECTION_SCHEMAS.personalTasks>;

async function restoreJournal(supabase: SupabaseClient, userId: string, data: Journal) {
  await run(supabase.from("journal_entries").delete().eq("user_id", userId));
  if (data.entries.length === 0) return;
  await run(
    supabase.from("journal_entries").insert(
      data.entries.map((e) => ({
        id: e.id,
        user_id: userId,
        entry_date: e.entry_date,
        content: e.content,
        created_at: e.created_at,
      })),
    ),
  );
}

async function restoreWorkouts(supabase: SupabaseClient, userId: string, data: Workouts) {
  // Deleting workout_sessions cascades to session_exercises and
  // exercise_sets — the child rows never need their own delete call.
  await run(supabase.from("workout_sessions").delete().eq("user_id", userId));
  if (data.sessions.length === 0) return;

  await run(
    supabase.from("workout_sessions").insert(
      data.sessions.map((s) => ({
        id: s.id,
        user_id: userId,
        session_date: s.session_date,
        name: s.name,
        category: s.category,
        created_at: s.created_at,
      })),
    ),
  );

  const exerciseRows = data.sessions.flatMap((s) =>
    s.exercises.map((e) => ({
      id: e.id,
      session_id: s.id,
      exercise_name: e.exercise_name,
      position: e.position,
      created_at: e.created_at,
    })),
  );
  if (exerciseRows.length > 0) {
    await run(supabase.from("session_exercises").insert(exerciseRows));
  }

  const setRows = data.sessions.flatMap((s) =>
    s.exercises.flatMap((e) =>
      e.sets.map((set) => ({
        id: set.id,
        session_exercise_id: e.id,
        set_number: set.set_number,
        weight: set.weight,
        reps: set.reps,
        notes: set.notes,
        created_at: set.created_at,
      })),
    ),
  );
  if (setRows.length > 0) {
    await run(supabase.from("exercise_sets").insert(setRows));
  }
}

async function restoreHabits(supabase: SupabaseClient, userId: string, data: Habits) {
  await run(supabase.from("habits").delete().eq("user_id", userId));
  if (data.habits.length === 0) return;

  await run(
    supabase.from("habits").insert(
      data.habits.map((h) => ({
        id: h.id,
        user_id: userId,
        name: h.name,
        position: h.position,
        created_at: h.created_at,
      })),
    ),
  );

  const completionRows = data.habits.flatMap((h) =>
    h.completions.map((c) => ({
      id: c.id,
      habit_id: h.id,
      completed_date: c.completed_date,
      created_at: c.created_at,
    })),
  );
  if (completionRows.length > 0) {
    await run(supabase.from("daily_habit_completions").insert(completionRows));
  }
}

// meal_plan_entries has no delete policy — it's designed to be upserted
// onto (user_id, week_start_date, day_of_week, meal_slot) forever, never
// deleted (see SECTION_CAVEATS.mealPlan). id is deliberately left out of
// the upsert payload: the conflict target is the natural key, not id, so
// an existing row at that slot keeps its own id and just gets its other
// columns overwritten.
async function restoreMealPlan(supabase: SupabaseClient, userId: string, data: MealPlan) {
  if (data.entries.length === 0) return;
  await run(
    supabase.from("meal_plan_entries").upsert(
      data.entries.map((e) => ({
        user_id: userId,
        week_start_date: e.week_start_date,
        day_of_week: e.day_of_week,
        meal_slot: e.meal_slot,
        mode: e.mode,
        content: e.content,
        leftover_day_of_week: e.leftover_day_of_week,
        leftover_meal_slot: e.leftover_meal_slot,
        updated_at: e.updated_at,
      })),
      { onConflict: "user_id,week_start_date,day_of_week,meal_slot" },
    ),
  );
}

async function restoreGrocery(supabase: SupabaseClient, userId: string, data: Grocery) {
  await run(supabase.from("grocery_items").delete().eq("user_id", userId));
  await run(supabase.from("grocery_staples").delete().eq("user_id", userId));

  if (data.items.length > 0) {
    await run(
      supabase.from("grocery_items").insert(
        data.items.map((i) => ({
          id: i.id,
          user_id: userId,
          content: i.content,
          checked: i.checked,
          created_at: i.created_at,
        })),
      ),
    );
  }
  if (data.staples.length > 0) {
    await run(
      supabase.from("grocery_staples").insert(
        data.staples.map((s) => ({ id: s.id, user_id: userId, content: s.content, created_at: s.created_at })),
      ),
    );
  }
}

async function restoreCleaning(supabase: SupabaseClient, userId: string, data: Cleaning) {
  await run(supabase.from("cleaning_tasks").delete().eq("user_id", userId));
  if (data.tasks.length === 0) return;

  await run(
    supabase.from("cleaning_tasks").insert(
      data.tasks.map((t) => ({
        id: t.id,
        user_id: userId,
        name: t.name,
        frequency: t.frequency,
        created_at: t.created_at,
      })),
    ),
  );

  const completionRows = data.tasks.flatMap((t) =>
    t.completions.map((c) => ({ id: c.id, task_id: t.id, completed_at: c.completed_at })),
  );
  if (completionRows.length > 0) {
    await run(supabase.from("cleaning_task_completions").insert(completionRows));
  }
}

async function restoreAnnualGoals(supabase: SupabaseClient, userId: string, data: AnnualGoals) {
  await run(supabase.from("annual_goals").delete().eq("user_id", userId));
  if (data.goals.length === 0) return;

  await run(
    supabase.from("annual_goals").insert(
      data.goals.map((g) => ({
        id: g.id,
        user_id: userId,
        title: g.title,
        description: g.description,
        position: g.position,
        created_at: g.created_at,
      })),
    ),
  );

  const checkpointRows = data.goals.flatMap((g) =>
    g.checkpoints.map((c) => ({
      id: c.id,
      goal_id: g.id,
      quarter: c.quarter,
      target_description: c.target_description,
      completed: c.completed,
      completed_at: c.completed_at,
    })),
  );
  if (checkpointRows.length > 0) {
    await run(supabase.from("goal_checkpoints").insert(checkpointRows));
  }

  const noteRows = data.goals.flatMap((g) =>
    g.checkin_notes.map((n) => ({ id: n.id, goal_id: g.id, note: n.note, created_at: n.created_at })),
  );
  if (noteRows.length > 0) {
    await run(supabase.from("goal_checkin_notes").insert(noteRows));
  }
}

async function restoreContacts(supabase: SupabaseClient, userId: string, data: Contacts) {
  await run(supabase.from("contacts").delete().eq("user_id", userId));
  if (data.contacts.length === 0) return;

  await run(
    supabase.from("contacts").insert(
      data.contacts.map((c) => ({
        id: c.id,
        user_id: userId,
        name: c.name,
        category: c.category,
        birthday: c.birthday,
        important_date: c.important_date,
        important_date_label: c.important_date_label,
        notes: c.notes,
        gift_ideas: c.gift_ideas,
        cadence_days: c.cadence_days,
        created_at: c.created_at,
      })),
    ),
  );

  const logRows = data.contacts.flatMap((c) =>
    c.log.map((entry) => ({ id: entry.id, contact_id: c.id, contacted_at: entry.contacted_at })),
  );
  if (logRows.length > 0) {
    await run(supabase.from("contact_log").insert(logRows));
  }
}

// weight_entries has a delete policy and a natural (user_id, entry_date)
// key, so entries get a genuine delete-then-insert. weight_goal has no
// delete policy (singleton, upserted forever — see SECTION_CAVEATS) — a
// null goal in the backup is left untouched rather than attempting (and
// failing) to clear it.
async function restoreWeightTracker(supabase: SupabaseClient, userId: string, data: WeightTracker) {
  await run(supabase.from("weight_entries").delete().eq("user_id", userId));
  if (data.entries.length > 0) {
    await run(
      supabase.from("weight_entries").insert(
        data.entries.map((e) => ({
          id: e.id,
          user_id: userId,
          entry_date: e.entry_date,
          weight: e.weight,
          created_at: e.created_at,
        })),
      ),
    );
  }

  if (data.goal) {
    await run(
      supabase.from("weight_goal").upsert(
        {
          user_id: userId,
          goal_weight: data.goal.goal_weight,
          target_date: data.goal.target_date,
          updated_at: data.goal.updated_at,
        },
        { onConflict: "user_id" },
      ),
    );
  }
}

async function restorePersonalTasks(supabase: SupabaseClient, userId: string, data: PersonalTasks) {
  await run(supabase.from("personal_tasks").delete().eq("user_id", userId));
  if (data.tasks.length === 0) return;
  await run(
    supabase.from("personal_tasks").insert(
      data.tasks.map((t) => ({ id: t.id, user_id: userId, content: t.content, created_at: t.created_at })),
    ),
  );
}

export async function restoreDataSection(
  section: RestorableSection,
  rawData: unknown,
): Promise<RestoreResult> {
  if (!RESTORABLE_SECTIONS.includes(section)) {
    return { error: "Unknown backup section." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to restore data." };
  }

  const schema = SECTION_SCHEMAS[section];
  const parsed = schema.safeParse(rawData);
  if (!parsed.success) {
    return { error: "This section's data doesn't match the expected shape — nothing was changed." };
  }

  try {
    switch (section) {
      case "journal":
        await restoreJournal(supabase, user.id, parsed.data as Journal);
        break;
      case "workouts":
        await restoreWorkouts(supabase, user.id, parsed.data as Workouts);
        break;
      case "habits":
        await restoreHabits(supabase, user.id, parsed.data as Habits);
        break;
      case "mealPlan":
        await restoreMealPlan(supabase, user.id, parsed.data as MealPlan);
        break;
      case "grocery":
        await restoreGrocery(supabase, user.id, parsed.data as Grocery);
        break;
      case "cleaning":
        await restoreCleaning(supabase, user.id, parsed.data as Cleaning);
        break;
      case "annualGoals":
        await restoreAnnualGoals(supabase, user.id, parsed.data as AnnualGoals);
        break;
      case "contacts":
        await restoreContacts(supabase, user.id, parsed.data as Contacts);
        break;
      case "weightTracker":
        await restoreWeightTracker(supabase, user.id, parsed.data as WeightTracker);
        break;
      case "personalTasks":
        await restorePersonalTasks(supabase, user.id, parsed.data as PersonalTasks);
        break;
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Restore failed partway through: ${error.message}. Some rows in this section may be missing — try restoring it again.`
          : "Restore failed for an unknown reason.",
    };
  }

  revalidatePath("/");
  return { success: true, message: "Restored successfully." };
}
