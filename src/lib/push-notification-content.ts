import { isContactVisible, type ContactWithStatus } from "./contacts-utils";
import type { HabitWithCompletions } from "./habit-utils";

export type DailyReminderContent = { title: string; body: string };

// Builds the daily push reminder's content from raw habits/contacts, or
// returns null when there's genuinely nothing due — no "nothing to do
// today!" notification, just silence, since a push that says nothing
// useful is worse than no push at all.
export function buildDailyReminderContent(
  habits: HabitWithCompletions[],
  todayLocalDate: string,
  contacts: ContactWithStatus[],
): DailyReminderContent | null {
  const outstandingHabits = habits.filter((habit) => !habit.completedDates.includes(todayLocalDate));
  const dueContacts = contacts.filter(isContactVisible);

  if (outstandingHabits.length === 0 && dueContacts.length === 0) return null;

  const parts: string[] = [];
  if (outstandingHabits.length > 0) {
    parts.push(`${outstandingHabits.length} habit${outstandingHabits.length === 1 ? "" : "s"} due today`);
  }
  if (dueContacts.length > 0) {
    parts.push(`${dueContacts.length} contact${dueContacts.length === 1 ? "" : "s"} to reach out to`);
  }

  return { title: "Life Dashboard", body: parts.join(" · ") };
}
