export const CLEANING_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;

export type CleaningFrequency = (typeof CLEANING_FREQUENCIES)[number];

export const CLEANING_FREQUENCY_LABELS: Record<CleaningFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

// Fixed day counts rather than calendar-aware intervals (e.g. "the same day
// next month") — simpler, and matches "just a simple recurring checklist".
export const CLEANING_FREQUENCY_INTERVAL_DAYS: Record<CleaningFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

export type CleaningTask = {
  id: string;
  name: string;
  frequency: CleaningFrequency;
  createdAt: string;
};

export type CleaningTaskWithStatus = CleaningTask & {
  lastCompletedAt: string | null; // ISO instant, or null if never completed
  isDue: boolean;
  daysSinceCompleted: number | null; // null if never completed
  daysUntilDue: number | null; // null if already due
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Due status is computed from elapsed real time since the last completion,
// not from a calendar-day comparison — an instant diff (now - lastCompletedAt)
// is timezone-independent, unlike "is it a new calendar day yet" checks
// elsewhere in this app, so this is safe to compute on the server as well
// as the client without needing the browser's local date.
export function computeCleaningStatus(
  task: CleaningTask,
  lastCompletedAt: string | null,
  now: Date = new Date(),
): CleaningTaskWithStatus {
  if (!lastCompletedAt) {
    return {
      ...task,
      lastCompletedAt: null,
      isDue: true,
      daysSinceCompleted: null,
      daysUntilDue: null,
    };
  }

  const elapsedMs = now.getTime() - new Date(lastCompletedAt).getTime();
  const intervalMs = CLEANING_FREQUENCY_INTERVAL_DAYS[task.frequency] * DAY_MS;
  const isDue = elapsedMs >= intervalMs;

  return {
    ...task,
    lastCompletedAt,
    isDue,
    daysSinceCompleted: Math.max(0, Math.floor(elapsedMs / DAY_MS)),
    daysUntilDue: isDue ? null : Math.ceil((intervalMs - elapsedMs) / DAY_MS),
  };
}

// Only tasks that are due (any amount overdue) or coming due within the
// given window are shown — everything further out still exists and will
// reappear on its own as its due date approaches, since visibility is
// recomputed fresh from computeCleaningStatus every time, not stored.
export function isCleaningTaskVisible(task: CleaningTaskWithStatus, withinDays = 7): boolean {
  return task.isDue || (task.daysUntilDue !== null && task.daysUntilDue <= withinDays);
}
