export const CONTACT_CATEGORIES = ["Family", "Friends", "Work", "Extended Family"] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export type Contact = {
  id: string;
  name: string;
  category: ContactCategory;
  birthday: string | null; // "yyyy-mm-dd"
  importantDate: string | null; // "yyyy-mm-dd"
  importantDateLabel: string;
  notes: string;
  giftIdeas: string;
  cadenceDays: number;
  createdAt: string;
};

export type ContactWithStatus = Contact & {
  lastContactedAt: string | null; // ISO instant, or null if never contacted
  isDue: boolean;
  daysSinceContacted: number | null; // null if never contacted
  daysUntilDue: number | null; // null if already due
  nextDueAt: string | null; // ISO instant, or null if never contacted
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Due status is computed from elapsed real time since the last contact —
// same timezone-independent approach as Routine Cleaning Reminders (an
// instant diff needs no notion of the user's local calendar day), so this
// is safe to compute on the server as well as the client.
export function computeContactStatus(
  contact: Contact,
  lastContactedAt: string | null,
  now: Date = new Date(),
): ContactWithStatus {
  if (!lastContactedAt) {
    return {
      ...contact,
      lastContactedAt: null,
      isDue: true,
      daysSinceContacted: null,
      daysUntilDue: null,
      nextDueAt: null,
    };
  }

  const intervalMs = contact.cadenceDays * DAY_MS;
  const lastContactedMs = new Date(lastContactedAt).getTime();
  const elapsedMs = now.getTime() - lastContactedMs;
  const isDue = elapsedMs >= intervalMs;

  return {
    ...contact,
    lastContactedAt,
    isDue,
    daysSinceContacted: Math.max(0, Math.floor(elapsedMs / DAY_MS)),
    daysUntilDue: isDue ? null : Math.ceil((intervalMs - elapsedMs) / DAY_MS),
    nextDueAt: new Date(lastContactedMs + intervalMs).toISOString(),
  };
}

// Unlike Routine Cleaning Reminders' 7-day lookahead window, contacts only
// show in the main list once actually due or overdue — there's no separate
// "coming due soon" bucket here, just due/overdue vs. not-yet-due.
export function isContactVisible(contact: ContactWithStatus): boolean {
  return contact.isDue;
}
