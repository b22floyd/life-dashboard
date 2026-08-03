export type WeightEntry = {
  id: string;
  entryDate: string; // "yyyy-mm-dd"
  weight: number; // lb
};

export type WeightGoal = {
  goalWeight: number; // lb
  targetDate: string | null; // "yyyy-mm-dd"
} | null;

const DAY_MS = 24 * 60 * 60 * 1000;

// Local ("yyyy-mm-dd") date arithmetic, entirely independent of any
// particular timezone offset — never round-tripped through Date's UTC-based
// parsing. Mirrors the same helper in habit-utils.ts / meal-plan-utils.ts.
function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The Sunday that starts the week containing `localDateStr`.
function getWeekStartDate(localDateStr: string): string {
  const [year, month, day] = localDateStr.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = Sunday
  return addDays(localDateStr, -dayOfWeek);
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const [fy, fm, fd] = fromDateStr.split("-").map(Number);
  const [ty, tm, td] = toDateStr.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd).getTime();
  const to = new Date(ty, tm - 1, td).getTime();
  return Math.round((to - from) / DAY_MS);
}

export type WeekOverWeekChange = {
  thisWeekAvg: number;
  lastWeekAvg: number;
  change: number; // thisWeekAvg - lastWeekAvg; positive = gained, negative = lost
} | null;

// Compares the average of this week's logged entries (Sunday through today)
// against last week's average — null (rather than a misleading number) when
// either window has no data at all.
export function computeWeekOverWeekChange(
  entries: WeightEntry[],
  todayLocalDate: string,
): WeekOverWeekChange {
  const thisWeekStart = getWeekStartDate(todayLocalDate);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);

  const thisWeekEntries = entries.filter(
    (entry) => entry.entryDate >= thisWeekStart && entry.entryDate <= todayLocalDate,
  );
  const lastWeekEntries = entries.filter(
    (entry) => entry.entryDate >= lastWeekStart && entry.entryDate <= lastWeekEnd,
  );

  if (thisWeekEntries.length === 0 || lastWeekEntries.length === 0) {
    return null;
  }

  const average = (list: WeightEntry[]) =>
    list.reduce((sum, entry) => sum + entry.weight, 0) / list.length;

  const thisWeekAvg = average(thisWeekEntries);
  const lastWeekAvg = average(lastWeekEntries);

  return { thisWeekAvg, lastWeekAvg, change: thisWeekAvg - lastWeekAvg };
}

export type WeightGoalEstimate =
  | { status: "insufficient_data" }
  | { status: "already_at_goal" }
  | { status: "no_progress" }
  | { status: "on_track"; weeksLeft: number };

// Requires at least 14 days of history (not just 2 data points a day apart)
// before projecting anything — a wide gap between two entries would
// otherwise produce a wildly unreliable weekly rate.
const MIN_DAYS_ELAPSED = 14;

// Projects forward using the average rate of change since the first entry
// (total change / weeks elapsed), applied to however much weight remains
// between the most recent entry and the goal. Handles both a goal below the
// current weight (needs to be losing) and above it (needs to be gaining) —
// "no_progress" covers a flat or wrong-direction trend, where a projection
// would otherwise be negative or infinite.
export function estimateWeeksToGoal(
  entries: WeightEntry[], // must be sorted ascending by entryDate
  goalWeight: number,
  todayLocalDate: string,
): WeightGoalEstimate {
  if (entries.length < 2) {
    return { status: "insufficient_data" };
  }

  const first = entries[0];
  const latest = entries[entries.length - 1];
  const daysElapsed = daysBetween(first.entryDate, todayLocalDate);
  if (daysElapsed < MIN_DAYS_ELAPSED) {
    return { status: "insufficient_data" };
  }

  const remaining = latest.weight - goalWeight;
  if (Math.abs(remaining) < 0.05) {
    return { status: "already_at_goal" };
  }

  const weeksElapsed = daysElapsed / 7;
  const totalChange = first.weight - latest.weight; // positive = weight decreased
  const ratePerWeek = totalChange / weeksElapsed;
  // Rate of closing the gap toward the goal, regardless of which direction
  // that gap is in.
  const closingRatePerWeek = remaining > 0 ? ratePerWeek : -ratePerWeek;

  if (closingRatePerWeek <= 0) {
    return { status: "no_progress" };
  }

  return { status: "on_track", weeksLeft: Math.ceil(Math.abs(remaining) / closingRatePerWeek) };
}
