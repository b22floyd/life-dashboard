import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocalDateString } from "@/lib/date-utils";
import { computeCleaningStatus, type CleaningFrequency, type CleaningTask } from "@/lib/cleaning-utils";
import { computeContactStatus, type Contact, type ContactCategory } from "@/lib/contacts-utils";
import type { HabitWithCompletions } from "@/lib/habit-utils";
import { buildDailyReminderContent } from "@/lib/push-notification-content";

type RawHabit = {
  id: string;
  name: string;
  position: number;
  created_at: string;
  daily_habit_completions: { completed_date: string }[] | null;
};

type RawContact = {
  id: string;
  name: string;
  category: ContactCategory;
  birthday: string | null;
  important_date: string | null;
  important_date_label: string;
  notes: string;
  gift_ideas: string;
  cadence_days: number;
  created_at: string;
  contact_log: { contacted_at: string }[] | null;
};

type RawCleaningTask = {
  id: string;
  name: string;
  frequency: CleaningFrequency;
  created_at: string;
  cleaning_task_completions: { completed_at: string }[] | null;
};

// Runs once daily (see vercel.json) at a fixed UTC time chosen to land in
// the morning for an Eastern-US-based user — the same Charlotte, NC
// assumption WeatherWidget's own desktop default already makes — since
// there's nowhere in this single-user app that stores an actual timezone.
// "Today" below is likewise the server's own UTC calendar date rather than
// anything timezone-corrected: acceptable because the cron itself only ever
// fires around midday UTC (comfortably inside the same Eastern calendar day,
// nowhere near a UTC midnight boundary), the same class of simplification
// daily-glance.ts and MealPlanGroceryCard's own initial render already
// accept for the same reason.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: "Push notifications aren't configured." }, { status: 500 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const supabase = createAdminClient();

  // Single-user dashboard — same assumption the weekly backup cron already
  // makes.
  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers();
  const user = usersPage?.users[0];
  if (usersError || !user) {
    return NextResponse.json(
      { error: usersError?.message ?? "No user found." },
      { status: 500 },
    );
  }

  const [subscriptionsRes, habitsRes, contactsRes, cleaningRes] = await Promise.all([
    supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", user.id),
    supabase
      .from("habits")
      .select("id, name, position, created_at, daily_habit_completions(completed_date)")
      .eq("user_id", user.id),
    supabase
      .from("contacts")
      .select(
        `id, name, category, birthday, important_date, important_date_label, notes, gift_ideas, cadence_days, created_at,
         contact_log (contacted_at)`,
      )
      .eq("user_id", user.id),
    supabase
      .from("cleaning_tasks")
      .select("id, name, frequency, created_at, cleaning_task_completions(completed_at)")
      .eq("user_id", user.id),
  ]);

  if (subscriptionsRes.error || habitsRes.error || contactsRes.error || cleaningRes.error) {
    console.error(
      "Push reminder cron failed to load data:",
      subscriptionsRes.error?.message ??
        habitsRes.error?.message ??
        contactsRes.error?.message ??
        cleaningRes.error?.message,
    );
    return NextResponse.json({ error: "Failed to load reminder data." }, { status: 500 });
  }

  const subscriptions = subscriptionsRes.data ?? [];
  if (subscriptions.length === 0) {
    return NextResponse.json({ success: true, sent: 0, reason: "No push subscriptions." });
  }

  const habits: HabitWithCompletions[] = ((habitsRes.data ?? []) as RawHabit[]).map((habit) => ({
    id: habit.id,
    name: habit.name,
    position: habit.position,
    created_at: habit.created_at,
    completedDates: (habit.daily_habit_completions ?? []).map((c) => c.completed_date),
  }));

  const now = new Date();
  const contacts = ((contactsRes.data ?? []) as RawContact[]).map((row) => {
    const logs = row.contact_log ?? [];
    const lastContactedAt =
      logs.length === 0
        ? null
        : logs.reduce(
            (latest, log) =>
              new Date(log.contacted_at).getTime() > new Date(latest).getTime() ? log.contacted_at : latest,
            logs[0].contacted_at,
          );

    const contact: Contact = {
      id: row.id,
      name: row.name,
      category: row.category,
      birthday: row.birthday,
      importantDate: row.important_date,
      importantDateLabel: row.important_date_label,
      notes: row.notes,
      giftIdeas: row.gift_ideas,
      cadenceDays: row.cadence_days,
      createdAt: row.created_at,
    };
    return computeContactStatus(contact, lastContactedAt, now);
  });

  const today = getLocalDateString();

  const cleaningTasks = ((cleaningRes.data ?? []) as RawCleaningTask[]).map((row) => {
    const completions = row.cleaning_task_completions ?? [];
    const lastCompletedAt =
      completions.length === 0
        ? null
        : completions.reduce(
            (latest, c) =>
              new Date(c.completed_at).getTime() > new Date(latest).getTime() ? c.completed_at : latest,
            completions[0].completed_at,
          );

    const task: CleaningTask = {
      id: row.id,
      name: row.name,
      frequency: row.frequency,
      createdAt: row.created_at,
    };
    return computeCleaningStatus(task, lastCompletedAt, today);
  });

  const content = buildDailyReminderContent(habits, today, contacts, cleaningTasks);
  if (!content) {
    return NextResponse.json({ success: true, sent: 0, reason: "Nothing due today." });
  }

  const payload = JSON.stringify({ title: content.title, body: content.body, tag: "daily-reminder" });

  let sent = 0;
  const staleEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        );
        sent += 1;
      } catch (error) {
        // A 404/410 means the push service itself says this subscription no
        // longer exists (browser data cleared, uninstalled, etc.) — clean it
        // up rather than retrying the same dead endpoint every single day.
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(subscription.endpoint);
        } else {
          console.error(
            "Failed to send push notification:",
            error instanceof Error ? error.message : error,
          );
        }
      }
    }),
  );

  if (staleEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().eq("user_id", user.id).in("endpoint", staleEndpoints);
  }

  return NextResponse.json({ success: true, sent, staleRemoved: staleEndpoints.length });
}
