import { getLocalDateString } from "@/lib/date-utils";

export const CLEANING_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;

export type CleaningFrequency = (typeof CLEANING_FREQUENCIES)[number];

export const CLEANING_FREQUENCY_LABELS: Record<CleaningFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

export type CleaningTask = {
  id: string;
  name: string;
  frequency: CleaningFrequency;
  createdAt: string;
};

export type CleaningTaskWithStatus = CleaningTask & {
  lastCompletedAt: string | null; // ISO instant, or null if never completed
  isDue: boolean; // needs attention now — due this week, or overdue from a past due week
  isHidden: boolean; // done for the current cycle, waiting for Monday to reappear
  daysUntilDue: number | null; // days from today to the next due Sunday; null while isDue
  nextDueAt: string | null; // ISO instant (local midnight) of a Sunday: the
  // active overdue/due deadline while isDue, otherwise the next upcoming one
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Local-date ("yyyy-mm-dd") arithmetic, entirely independent of any
// particular timezone offset — mirrors the same private helper in
// habit-utils.ts / meal-plan-utils.ts.
function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function diffDays(fromDateStr: string, toDateStr: string): number {
  const [fy, fm, fd] = fromDateStr.split("-").map(Number);
  const [ty, tm, td] = toDateStr.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

// A due Sunday is represented everywhere else as an ISO instant (matching
// every other "absolute timestamp" field in this app) — local midnight of
// that calendar day, since a due date has no meaningful time-of-day of
// its own.
function toIsoInstant(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0 = Sunday .. 6 = Saturday
}

// The Sunday ending the Monday-Sunday week that contains dateStr.
function getWeekSunday(dateStr: string): string {
  const daysToAdd = (7 - getDayOfWeek(dateStr)) % 7;
  return addDays(dateStr, daysToAdd);
}

// A fixed, known Sunday used purely as a reference point for alternating
// biweekly parity — not tied to any task's own history, so every biweekly
// task shares the exact same every-other-Sunday schedule rather than each
// one drifting onto its own rhythm based on when it happened to be created
// or completed.
const BIWEEKLY_ANCHOR_SUNDAY = "2024-01-07";

function weeksSinceAnchor(sundayStr: string): number {
  const [ay, am, ad] = BIWEEKLY_ANCHOR_SUNDAY.split("-").map(Number);
  const [y, m, d] = sundayStr.split("-").map(Number);
  const anchor = new Date(ay, am - 1, ad);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - anchor.getTime()) / (7 * DAY_MS));
}

// Whether the Monday-Sunday week ending on `sundayStr` is a due week for
// this frequency — a pure function of the calendar, never of any task's
// completion history, which is the whole point of "fixed weekly alignment"
// over a rolling interval: the schedule itself never drifts.
function isDueWeek(frequency: CleaningFrequency, sundayStr: string): boolean {
  switch (frequency) {
    case "weekly":
      return true;
    case "biweekly": {
      const weeks = weeksSinceAnchor(sundayStr);
      return ((weeks % 2) + 2) % 2 === 0;
    }
    case "monthly": {
      // The first Sunday of any month always falls within days 1-7.
      const day = Number(sundayStr.split("-")[2]);
      return day <= 7;
    }
  }
}

// Walks backward from this week's Sunday (inclusive) to find the most
// recent due week — for weekly that's always this week; for biweekly/
// monthly it may be a week or several weeks back if this week is an
// "off" week in the schedule. Bounded at 5 weeks, comfortably more than
// monthly's worst case of ~4.
function findActiveDueSunday(frequency: CleaningFrequency, todayLocalDate: string): string {
  let sunday = getWeekSunday(todayLocalDate);
  for (let i = 0; i < 5; i++) {
    if (isDueWeek(frequency, sunday)) return sunday;
    sunday = addDays(sunday, -7);
  }
  return sunday;
}

function findNextDueSunday(frequency: CleaningFrequency, afterSunday: string): string {
  let sunday = addDays(afterSunday, 7);
  for (let i = 0; i < 5; i++) {
    if (isDueWeek(frequency, sunday)) return sunday;
    sunday = addDays(sunday, 7);
  }
  return sunday;
}

// Fixed weekly-alignment scheduling: every frequency maps to a shared,
// purely calendar-based set of due Sundays (weekly = every Sunday,
// biweekly = every other Sunday off a fixed anchor, monthly = the first
// Sunday of the month) rather than a rolling interval counted forward from
// whenever the task last happened to get done. Completing a task never
// shifts its future due dates — it only satisfies the *current* cycle.
//
// "Current cycle" is the most recent due week (walking back from this
// week if this week isn't itself a due week) that hasn't yet been
// completed on or after its own Monday. A task stays `isDue` — visible and
// actionable — for the whole span from that Monday through Sunday, and
// stays overdue (still `isDue`) indefinitely past that Sunday until it's
// actually done, even across further off-weeks. Once completed for the
// cycle, it's `isHidden` only through the end of that same week; the very
// next Monday it becomes visible again, now just counting down
// (`daysUntilDue`) to its next scheduled Sunday.
export function computeCleaningStatus(
  task: CleaningTask,
  lastCompletedAt: string | null,
  todayLocalDate: string,
): CleaningTaskWithStatus {
  const activeDueSunday = findActiveDueSunday(task.frequency, todayLocalDate);
  const activeDueMonday = addDays(activeDueSunday, -6);

  const lastCompletedLocalDate = lastCompletedAt
    ? getLocalDateString(new Date(lastCompletedAt))
    : null;
  const completedForActiveCycle =
    lastCompletedLocalDate !== null && lastCompletedLocalDate >= activeDueMonday;

  if (!completedForActiveCycle) {
    return {
      ...task,
      lastCompletedAt,
      isDue: true,
      isHidden: false,
      daysUntilDue: null,
      nextDueAt: toIsoInstant(activeDueSunday),
    };
  }

  const mondayAfterActiveDue = addDays(activeDueSunday, 1);
  const isHidden = todayLocalDate < mondayAfterActiveDue;
  const nextDueSunday = findNextDueSunday(task.frequency, activeDueSunday);

  return {
    ...task,
    lastCompletedAt,
    isDue: false,
    isHidden,
    daysUntilDue: diffDays(todayLocalDate, nextDueSunday),
    nextDueAt: toIsoInstant(nextDueSunday),
  };
}
