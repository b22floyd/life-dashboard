import { describe, expect, it } from "vitest";
import { computeWeekOverWeekChange, estimateWeeksToGoal, type WeightEntry } from "./weight-utils";

function entry(entryDate: string, weight: number): WeightEntry {
  return { id: entryDate, entryDate, weight };
}

// 2024-03-10 and 2024-03-17 are both Sundays (verified via Date().getDay()),
// so the week containing 2024-03-13 (a Wednesday) runs 03-10 through 03-16,
// and the prior week runs 03-03 through 03-09.
describe("computeWeekOverWeekChange", () => {
  const today = "2024-03-13";

  it("averages this week's and last week's entries and returns the difference", () => {
    const entries = [
      entry("2024-03-10", 180), // this week
      entry("2024-03-12", 178), // this week
      entry("2024-03-04", 182), // last week
      entry("2024-03-06", 181), // last week
    ];
    const result = computeWeekOverWeekChange(entries, today);
    expect(result).not.toBeNull();
    expect(result!.thisWeekAvg).toBeCloseTo(179, 5);
    expect(result!.lastWeekAvg).toBeCloseTo(181.5, 5);
    expect(result!.change).toBeCloseTo(-2.5, 5);
  });

  it("includes entries exactly on the week-start/week-end boundary dates", () => {
    const entries = [
      entry("2024-03-10", 180), // this week's Sunday boundary
      entry("2024-03-09", 182), // last week's Saturday boundary
    ];
    const result = computeWeekOverWeekChange(entries, today);
    expect(result).toEqual({ thisWeekAvg: 180, lastWeekAvg: 182, change: -2 });
  });

  it("returns null when there's no data for the current week", () => {
    const entries = [entry("2024-03-04", 182)];
    expect(computeWeekOverWeekChange(entries, today)).toBeNull();
  });

  it("returns null when there's no data for the prior week", () => {
    const entries = [entry("2024-03-10", 180)];
    expect(computeWeekOverWeekChange(entries, today)).toBeNull();
  });

  it("returns null with no entries at all", () => {
    expect(computeWeekOverWeekChange([], today)).toBeNull();
  });
});

describe("estimateWeeksToGoal", () => {
  it("reports insufficient_data with fewer than two entries", () => {
    expect(estimateWeeksToGoal([entry("2024-01-01", 190)], 180, "2024-02-01")).toEqual({
      status: "insufficient_data",
    });
  });

  it("reports insufficient_data when fewer than 14 days have elapsed", () => {
    const entries = [entry("2024-01-01", 190), entry("2024-01-05", 188)];
    expect(estimateWeeksToGoal(entries, 180, "2024-01-05")).toEqual({ status: "insufficient_data" });
  });

  it("reports already_at_goal when the latest entry is within 0.05 lb of the goal", () => {
    const entries = [entry("2024-01-01", 185), entry("2024-01-20", 180.02)];
    expect(estimateWeeksToGoal(entries, 180, "2024-01-20")).toEqual({ status: "already_at_goal" });
  });

  it("reports no_progress when trending away from a weight-loss goal", () => {
    const entries = [entry("2024-01-01", 190), entry("2024-01-29", 195)];
    expect(estimateWeeksToGoal(entries, 180, "2024-01-29")).toEqual({ status: "no_progress" });
  });

  it("projects weeks remaining when losing toward a lower goal", () => {
    const entries = [entry("2024-01-01", 200), entry("2024-02-01", 190)];
    const result = estimateWeeksToGoal(entries, 180, "2024-02-01");
    expect(result.status).toBe("on_track");
    if (result.status === "on_track") {
      expect(result.weeksLeft).toBe(5);
    }
  });

  it("projects weeks remaining when gaining toward a higher goal", () => {
    const entries = [entry("2024-01-01", 150), entry("2024-01-29", 155)];
    const result = estimateWeeksToGoal(entries, 160, "2024-01-29");
    expect(result.status).toBe("on_track");
    if (result.status === "on_track") {
      expect(result.weeksLeft).toBe(4);
    }
  });

  it("only uses the first and latest entries, ignoring points in between", () => {
    const entries = [
      entry("2024-01-01", 200),
      entry("2024-01-15", 500), // wild outlier — must not affect the projection
      entry("2024-02-01", 190),
    ];
    const result = estimateWeeksToGoal(entries, 180, "2024-02-01");
    expect(result.status).toBe("on_track");
    if (result.status === "on_track") {
      expect(result.weeksLeft).toBe(5);
    }
  });
});
