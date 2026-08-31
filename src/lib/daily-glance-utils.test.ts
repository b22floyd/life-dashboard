import { describe, expect, it } from "vitest";
import { categorizeDueToday, isTodoistTaskDueTodayOrOverdue } from "./daily-glance-utils";

describe("categorizeDueToday", () => {
  it("treats a null nextDueAt (never done) as due-today, not overdue", () => {
    expect(categorizeDueToday(null, "2026-08-15")).toBe("due-today");
  });

  it("is due-today when the due date is today", () => {
    const nextDueAt = new Date(2026, 7, 15).toISOString();
    expect(categorizeDueToday(nextDueAt, "2026-08-15")).toBe("due-today");
  });

  it("is overdue when the due date is before today", () => {
    const nextDueAt = new Date(2026, 7, 10).toISOString();
    expect(categorizeDueToday(nextDueAt, "2026-08-15")).toBe("overdue");
  });

  it("is not overdue when the due date is in the future", () => {
    const nextDueAt = new Date(2026, 7, 20).toISOString();
    expect(categorizeDueToday(nextDueAt, "2026-08-15")).toBe("due-today");
  });
});

describe("isTodoistTaskDueTodayOrOverdue", () => {
  it("is true for a plain date-only string equal to today", () => {
    expect(isTodoistTaskDueTodayOrOverdue("2026-08-15", "2026-08-15")).toBe(true);
  });

  it("is true for a date-only string before today (overdue)", () => {
    expect(isTodoistTaskDueTodayOrOverdue("2026-08-10", "2026-08-15")).toBe(true);
  });

  it("is false for a date-only string after today", () => {
    expect(isTodoistTaskDueTodayOrOverdue("2026-08-20", "2026-08-15")).toBe(false);
  });

  it("handles a full datetime string the same way, by local calendar day", () => {
    expect(isTodoistTaskDueTodayOrOverdue("2026-08-15T23:00:00", "2026-08-15")).toBe(true);
    expect(isTodoistTaskDueTodayOrOverdue("2026-08-16T00:30:00", "2026-08-15")).toBe(false);
  });

  it("returns false rather than throwing on an unparseable date", () => {
    expect(isTodoistTaskDueTodayOrOverdue("not-a-date", "2026-08-15")).toBe(false);
  });
});
