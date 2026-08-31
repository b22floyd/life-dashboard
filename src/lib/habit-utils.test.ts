import { describe, expect, it } from "vitest";
import { computeHabitStreaks, getChainCalendar, type HabitWithCompletions } from "./habit-utils";

// Builds an ISO instant from local-timezone date components rather than a
// hardcoded "...Z" literal — computeHabitStreaks converts created_at back to
// a local calendar date, so a literal UTC string would resolve to a
// different (often wrong) local day depending on whatever timezone the test
// happens to run in. Constructing via local Date components and round-
// tripping through toISOString() is deterministic on any machine.
function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

function habit(
  createdAtLocal: [number, number, number] | [number, number, number, number],
  completedDates: string[],
): HabitWithCompletions {
  return {
    id: "h1",
    name: "Test Habit",
    position: 0,
    created_at: localIso(...createdAtLocal),
    completedDates,
  };
}

describe("computeHabitStreaks", () => {
  it("is 0/0 for a habit created today with no completions and today not done", () => {
    const result = computeHabitStreaks(habit([2026, 8, 15], []), "2026-08-15");
    expect(result).toEqual({ current: 0, best: 0 });
  });

  it("counts a perfect run with no misses", () => {
    const dates = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"];
    const result = computeHabitStreaks(habit([2026, 8, 1], dates), "2026-08-05");
    expect(result).toEqual({ current: 5, best: 5 });
  });

  it("does not treat a not-yet-completed today as a miss", () => {
    // Today isn't in completedDates, but it's simply excluded from the
    // evaluated range rather than counted as a break.
    const dates = ["2026-08-01", "2026-08-02", "2026-08-03"];
    const result = computeHabitStreaks(habit([2026, 8, 1], dates), "2026-08-04");
    expect(result).toEqual({ current: 3, best: 3 });
  });

  it("forgives a single missed day within a rolling 7-day window", () => {
    // Aug 1-7, miss only Aug 4 — one miss in the window, streak keeps going.
    const dates = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-05", "2026-08-06", "2026-08-07"];
    const result = computeHabitStreaks(habit([2026, 8, 1], dates), "2026-08-07");
    expect(result.current).toBe(7);
  });

  it("breaks the streak on a second miss within the same 7-day window", () => {
    // Aug 1-7, miss Aug 3 and Aug 6 — two misses inside one 7-day window.
    const dates = ["2026-08-01", "2026-08-02", "2026-08-04", "2026-08-05", "2026-08-07"];
    const result = computeHabitStreaks(habit([2026, 8, 1], dates), "2026-08-07");
    // Breaks on the day the second miss enters the window (Aug 6, a miss),
    // then Aug 7 (done) restarts the streak at 1.
    expect(result.current).toBe(1);
  });

  it("resets the window after a break rather than compounding penalties", () => {
    // A break on day N doesn't keep punishing days N+1, N+2, ... — the next
    // day's completion should immediately start counting again from 1.
    const dates = [
      "2026-08-01",
      "2026-08-04", // two misses (08-02, 08-03) already broke the streak
      "2026-08-05",
      "2026-08-06",
    ];
    const result = computeHabitStreaks(habit([2026, 8, 1], dates), "2026-08-06");
    expect(result.current).toBe(3); // 08-04, 08-05, 08-06 — a fresh run
  });

  it("tracks best separately from current once the streak has broken", () => {
    const dates = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-10"];
    // A long gap after 08-05 accumulates two misses in the trailing window
    // and resets to 0 twice before 08-10 restarts it — current ends low
    // while best keeps the high-water mark from the earlier run.
    const result = computeHabitStreaks(habit([2026, 8, 1], dates), "2026-08-10");
    expect(result.current).toBe(1);
    expect(result.best).toBeGreaterThanOrEqual(5);
  });

  it("uses the habit's local creation date, not a UTC slice of created_at", () => {
    // Created late evening local time such that the UTC instant already
    // rolled into the next calendar day — the streak must still start from
    // the local creation date, not one day later.
    const dates = ["2026-08-01", "2026-08-02"];
    const result = computeHabitStreaks(habit([2026, 8, 1, 23], dates), "2026-08-02");
    expect(result.current).toBe(2);
  });

  it("handles a habit created after today gracefully (empty range)", () => {
    const result = computeHabitStreaks(habit([2026, 8, 20], []), "2026-08-15");
    expect(result).toEqual({ current: 0, best: 0 });
  });
});

describe("getChainCalendar", () => {
  it("returns the requested number of days, oldest first, ending today", () => {
    const result = getChainCalendar(habit([2026, 8, 1], ["2026-08-05"]), "2026-08-05", 5);
    expect(result.map((d) => d.date)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
    expect(result[result.length - 1]).toEqual({ date: "2026-08-05", done: true });
  });

  it("marks each day done/not-done independently of streak-breaking rules", () => {
    const result = getChainCalendar(
      habit([2026, 8, 1], ["2026-08-01", "2026-08-03"]),
      "2026-08-03",
      3,
    );
    expect(result).toEqual([
      { date: "2026-08-01", done: true },
      { date: "2026-08-02", done: false },
      { date: "2026-08-03", done: true },
    ]);
  });

  it("defaults to 30 days when not specified", () => {
    const result = getChainCalendar(habit([2026, 1, 1], []), "2026-08-15");
    expect(result).toHaveLength(30);
  });
});
