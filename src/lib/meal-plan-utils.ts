export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export const MEAL_MODES = ["custom", "eating_out", "leftovers"] as const;

export type MealMode = (typeof MEAL_MODES)[number];

export const MEAL_MODE_LABELS: Record<MealMode, string> = {
  custom: "Custom",
  eating_out: "Eating Out",
  leftovers: "Leftovers",
};

export type MealPlanEntry = {
  weekStartDate: string; // "yyyy-mm-dd", the Sunday starting that week
  dayOfWeek: DayOfWeek;
  mealSlot: MealSlot;
  mode: MealMode;
  content: string; // used when mode === "custom"
  leftoverDayOfWeek: DayOfWeek | null; // used when mode === "leftovers"
  leftoverMealSlot: MealSlot | null;
};

// Local ("yyyy-mm-dd") date arithmetic, entirely independent of any
// particular timezone offset — never round-tripped through Date's UTC-based
// parsing. Mirrors the same helper in habit-utils.ts.
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The Sunday that starts the week containing `localDateStr`. Callers pass
// the browser's local date (getLocalDateString()) — a server-computed date
// would put the week boundary a few hours early/late relative to the user's
// actual local week, same class of bug as the rest of the app's timezone fixes.
export function getWeekStartDate(localDateStr: string): string {
  const [year, month, day] = localDateStr.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = Sunday
  return addDays(localDateStr, -dayOfWeek);
}

export function getPreviousWeekStartDate(weekStartDate: string): string {
  return addDays(weekStartDate, -7);
}

export function slotKey(dayOfWeek: DayOfWeek, mealSlot: MealSlot): string {
  return `${dayOfWeek}-${mealSlot}`;
}

export function formatWeekLabel(weekStartDate: string): string {
  const [year, month, day] = weekStartDate.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 6);
  const format = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Week of ${format(start)} – ${format(end)}`;
}
