import { getLocalDateString } from "@/lib/date-utils";

export type DueTodayStatus = "due-today" | "overdue";

// A cleaning task or contact becomes due on the calendar day its nextDueAt
// instant falls on locally (or immediately, for one that's never been
// done/contacted at all, which has no nextDueAt to compare against — that
// counts as due today rather than overdue, since there's no established
// prior due date to call it late against). Only called on items that are
// already due (isDue), so "not overdue" here always means due today, never
// "not due yet".
export function categorizeDueToday(
  nextDueAt: string | null,
  todayLocalDate: string,
): DueTodayStatus {
  if (!nextDueAt) return "due-today";
  const dueLocalDate = getLocalDateString(new Date(nextDueAt));
  return dueLocalDate < todayLocalDate ? "overdue" : "due-today";
}

// Mirrors TasksCardBody's own "Today" tab (due today counts, so does
// anything overdue) so this summary never disagrees with the Work Tasks
// card about what counts as "today".
export function isTodoistTaskDueTodayOrOverdue(
  dueDate: string,
  todayLocalDate: string,
): boolean {
  const due = dueDate.includes("T") ? new Date(dueDate) : new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  return getLocalDateString(due) <= todayLocalDate;
}
