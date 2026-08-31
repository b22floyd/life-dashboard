import { describe, expect, it } from "vitest";
import { computeCleaningStatus, type CleaningTask } from "./cleaning-utils";

// Local-timezone construction, not a hardcoded "...Z" literal — the function
// under test converts lastCompletedAt back to a local calendar date via
// getLocalDateString(new Date(...)), so a literal UTC string would resolve
// to a different (sometimes wrong) local day depending on the timezone the
// test happens to run in. See the same fix in habit-utils.test.ts.
function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

function task(frequency: CleaningTask["frequency"]): CleaningTask {
  return { id: "t1", name: "Test Task", frequency, createdAt: localIso(2024, 1, 1) };
}

// 2026-08-15 is a Saturday (Aug 16 is Sunday); the week's Sunday is 08-16.

describe("computeCleaningStatus — weekly", () => {
  it("is due when never completed", () => {
    const result = computeCleaningStatus(task("weekly"), null, "2026-08-15");
    expect(result.isDue).toBe(true);
    expect(result.nextDueAt).toBe(new Date(2026, 7, 16).toISOString());
  });

  it("is hidden through the rest of the due week once completed for it", () => {
    // Completed on the Monday (08-10) of the active week (Sunday 08-16).
    const result = computeCleaningStatus(task("weekly"), localIso(2026, 8, 10), "2026-08-15");
    expect(result.isDue).toBe(false);
    expect(result.isHidden).toBe(true);
  });

  it("stays due indefinitely once overdue, until actually completed", () => {
    // Never completed, evaluated a month later — still due, not silently
    // rolled forward to a fresh cycle.
    const result = computeCleaningStatus(task("weekly"), null, "2026-09-15");
    expect(result.isDue).toBe(true);
  });

  it("a completion from a previous cycle does not satisfy the current one", () => {
    // Completed two weeks ago — well before this week's Monday — so the
    // current week is still due.
    const result = computeCleaningStatus(task("weekly"), localIso(2026, 8, 1), "2026-08-15");
    expect(result.isDue).toBe(true);
  });

  it("has no off-weeks: the very next Monday is due again immediately, never just 'visible and counting down'", () => {
    // Unlike biweekly/monthly, weekly has no gap between cycles — completing
    // this week's task doesn't buy any not-due time once the new week starts.
    const result = computeCleaningStatus(task("weekly"), localIso(2026, 8, 10), "2026-08-17");
    expect(result.isDue).toBe(true);
  });
});

describe("computeCleaningStatus — biweekly", () => {
  it("alternates on/off weeks off the fixed anchor (2024-01-07)", () => {
    // The anchor Sunday and every other Sunday after it are "on" weeks.
    // 2024-01-07 + 14 days = 2024-01-21 (on), +7 = 2024-01-14 (off).
    const onWeekResult = computeCleaningStatus(task("biweekly"), null, "2024-01-21");
    const offWeekResult = computeCleaningStatus(task("biweekly"), null, "2024-01-14");
    // On an "on" week, due Sunday is this week's own Sunday.
    expect(onWeekResult.nextDueAt).toBe(new Date(2024, 0, 21).toISOString());
    // On an "off" week, it walks back to the most recent "on" Sunday.
    expect(offWeekResult.nextDueAt).toBe(new Date(2024, 0, 7).toISOString());
  });

  it("alternates strictly every other week, never twice in a row", () => {
    const sundays = ["2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30"];
    // "On" week: the active due Sunday is this week's own Sunday (no
    // walk-back needed). "Off" week: it resolves to some earlier Sunday.
    const isOnWeek = sundays.map((sunday) => {
      const result = computeCleaningStatus(task("biweekly"), null, sunday);
      const [y, m, d] = sunday.split("-").map(Number);
      return result.nextDueAt === new Date(y, m - 1, d).toISOString();
    });
    for (let i = 1; i < isOnWeek.length; i++) {
      expect(isOnWeek[i]).not.toBe(isOnWeek[i - 1]);
    }
  });

  it("becomes visible again (not hidden, counting down) on the Monday after an off-week begins", () => {
    // 2026-08-16 is an "on" Sunday; 2026-08-23 is the following "off" Sunday;
    // 2026-08-30 is the next "on" Sunday after that (verified against the
    // anchor parity above). Completing during the on-week (any day in the
    // Aug10-16 Monday-Sunday span) should leave the task visible again —
    // just counting down, not hidden — the moment the off-week's Monday
    // (Aug17) begins.
    const result = computeCleaningStatus(task("biweekly"), localIso(2026, 8, 10), "2026-08-17");
    expect(result.isDue).toBe(false);
    expect(result.isHidden).toBe(false);
    expect(result.nextDueAt).toBe(new Date(2026, 7, 30).toISOString());
    expect(result.daysUntilDue).toBe(13);
  });
});

describe("computeCleaningStatus — monthly", () => {
  it("is due on the first Sunday of the month", () => {
    // 2026-08-02 is the first Sunday of August 2026.
    const result = computeCleaningStatus(task("monthly"), null, "2026-08-02");
    expect(result.nextDueAt).toBe(new Date(2026, 7, 2).toISOString());
  });

  it("walks back to the first Sunday when evaluated later in the month", () => {
    const result = computeCleaningStatus(task("monthly"), null, "2026-08-20");
    expect(result.nextDueAt).toBe(new Date(2026, 7, 2).toISOString());
    expect(result.isDue).toBe(true);
  });

  it("finds next month's first Sunday once completed for this month", () => {
    // Completed on this month's due Monday-Sunday week.
    const result = computeCleaningStatus(task("monthly"), localIso(2026, 8, 2), "2026-08-20");
    expect(result.isDue).toBe(false);
    // September 2026's first Sunday is 2026-09-06.
    expect(result.nextDueAt).toBe(new Date(2026, 8, 6).toISOString());
  });
});

describe("computeCleaningStatus — daysUntilDue", () => {
  it("is null while isDue, and a positive count once satisfied", () => {
    const due = computeCleaningStatus(task("weekly"), null, "2026-08-15");
    expect(due.daysUntilDue).toBeNull();

    const satisfied = computeCleaningStatus(task("weekly"), localIso(2026, 8, 17), "2026-08-18");
    expect(satisfied.isDue).toBe(false);
    expect(satisfied.daysUntilDue).toBeGreaterThan(0);
  });
});
