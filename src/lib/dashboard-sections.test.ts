import { describe, expect, it } from "vitest";
import { DASHBOARD_SECTION_IDS, resolveSectionOrder } from "./dashboard-sections";

describe("resolveSectionOrder", () => {
  it("returns the canonical default order when nothing is saved", () => {
    expect(resolveSectionOrder(null)).toEqual([...DASHBOARD_SECTION_IDS]);
    expect(resolveSectionOrder([])).toEqual([...DASHBOARD_SECTION_IDS]);
  });

  it("preserves a fully valid saved order exactly", () => {
    const reversed = [...DASHBOARD_SECTION_IDS].reverse();
    expect(resolveSectionOrder(reversed)).toEqual(reversed);
  });

  it("drops an id that no longer exists — e.g. a removed section", () => {
    // This is exactly the mechanism that safely retires a saved order
    // referencing a section that's since been deleted (like Monarch): a
    // stale id is silently dropped rather than crashing or leaving a gap.
    const savedWithRemovedSection = [
      "workout-section",
      "not-a-real-section-anymore",
      "habits-section",
    ];
    const result = resolveSectionOrder(savedWithRemovedSection);
    expect(result).not.toContain("not-a-real-section-anymore");
    expect(result.slice(0, 2)).toEqual(["workout-section", "habits-section"]);
  });

  it("appends a new canonical section (missing from an old saved order) at the end", () => {
    const partialOldOrder = DASHBOARD_SECTION_IDS.filter((id) => id !== "health-section");
    const result = resolveSectionOrder([...partialOldOrder]);
    expect(result[result.length - 1]).toBe("health-section");
  });

  it("never drops a section for a saved order mixing valid and stale ids", () => {
    // A real saved order can never contain a duplicate (drag-reordering
    // only ever produces a permutation of unique ids), so this checks the
    // realistic shape of staleness: some valid ids plus some that no longer
    // exist, not an artificially malformed input.
    const messy = ["workout-section", "stale-id", "habits-section"];
    const result = resolveSectionOrder(messy);
    expect(result).toEqual(expect.arrayContaining([...DASHBOARD_SECTION_IDS]));
    expect(result).toHaveLength(DASHBOARD_SECTION_IDS.length);
  });
});
