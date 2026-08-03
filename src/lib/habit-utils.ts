export type Habit = {
  id: string;
  name: string;
  position: number;
  created_at: string;
};

export type HabitWithCompletions = Habit & {
  completedDates: string[]; // "yyyy-mm-dd"
};

export type HabitStreaks = {
  current: number;
  best: number;
};

export type ChainDay = {
  date: string; // "yyyy-mm-dd"
  done: boolean;
};

// Local-date ("yyyy-mm-dd") arithmetic, entirely independent of any
// particular timezone offset — these strings are never round-tripped
// through `Date`'s UTC-based parsing.
function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "yyyy-mm-dd" strings compare correctly with plain string comparison.
function isBeforeOrEqual(a: string, b: string): boolean {
  return a <= b;
}

// Lenient streak rule: within any rolling 7-day window, one missed day is
// forgiven and doesn't break the streak. A second missed day inside that
// same window breaks it — the streak resets to 0, and the window starts
// fresh again from the following day (otherwise the two miss-days that
// caused the break would keep forcing a reset for another week even after
// the habit is picked back up).
//
// "current" is evaluated as of `todayLocalDate`, but a not-yet-completed
// today is never treated as a miss — it's simply excluded from the
// evaluated range until the day is actually marked (missed or done).
export function computeHabitStreaks(
  habit: HabitWithCompletions,
  todayLocalDate: string,
): HabitStreaks {
  const completed = new Set(habit.completedDates);
  const startDate = habit.created_at.slice(0, 10);
  const endDate = completed.has(todayLocalDate)
    ? todayLocalDate
    : addDays(todayLocalDate, -1);

  let streak = 0;
  let best = 0;

  if (isBeforeOrEqual(startDate, endDate)) {
    let window: boolean[] = [];

    for (let date = startDate; isBeforeOrEqual(date, endDate); date = addDays(date, 1)) {
      const done = completed.has(date);
      window.push(done);
      if (window.length > 7) window.shift();

      const misses = window.filter((d) => !d).length;
      if (misses >= 2) {
        streak = 0;
        window = [];
      } else {
        streak += 1;
      }
      best = Math.max(best, streak);
    }
  }

  return { current: streak, best };
}

// Oldest-to-newest, ending today — for a left-to-right dot grid.
export function getChainCalendar(
  habit: HabitWithCompletions,
  todayLocalDate: string,
  days = 30,
): ChainDay[] {
  const completed = new Set(habit.completedDates);
  const result: ChainDay[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(todayLocalDate, -i);
    result.push({ date, done: completed.has(date) });
  }

  return result;
}
