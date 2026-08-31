import { describe, expect, it } from "vitest";
import { DATA_EXPORT_VERSION } from "./export";
import { parseBackupFile, summarizeSection } from "./restore-utils";

describe("parseBackupFile", () => {
  it("accepts a well-formed backup with the current version", () => {
    const result = parseBackupFile({ version: DATA_EXPORT_VERSION, exportedAt: "2026-08-01T00:00:00Z" });
    expect("data" in result).toBe(true);
  });

  it("rejects non-object input", () => {
    expect("error" in parseBackupFile(null)).toBe(true);
    expect("error" in parseBackupFile("just a string")).toBe(true);
    expect("error" in parseBackupFile(42)).toBe(true);
  });

  it("rejects an object missing version/exportedAt", () => {
    expect("error" in parseBackupFile({})).toBe(true);
    expect("error" in parseBackupFile({ version: DATA_EXPORT_VERSION })).toBe(true);
  });

  it("rejects a mismatched export version with a clear message", () => {
    const result = parseBackupFile({ version: 999, exportedAt: "2026-08-01T00:00:00Z" });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("999");
    }
  });
});

describe("summarizeSection", () => {
  it("summarizes a flat section", () => {
    expect(summarizeSection("journal", { entries: [{}, {}] })).toBe("Couldn't read this section from the file.");
    // A minimal, actually-valid journal entry:
    const valid = {
      entries: [{ id: "1", entry_date: "2026-08-01", content: "hi", created_at: "2026-08-01T00:00:00Z" }],
    };
    expect(summarizeSection("journal", valid)).toBe("1 entry");
  });

  it("pluralizes correctly at 0, 1, and many", () => {
    expect(summarizeSection("personalTasks", { tasks: [] })).toBe("0 tasks");
    expect(
      summarizeSection("personalTasks", {
        tasks: [{ id: "1", content: "x", created_at: "2026-08-01T00:00:00Z" }],
      }),
    ).toBe("1 task");
    expect(
      summarizeSection("personalTasks", {
        tasks: [
          { id: "1", content: "x", created_at: "2026-08-01T00:00:00Z" },
          { id: "2", content: "y", created_at: "2026-08-01T00:00:00Z" },
        ],
      }),
    ).toBe("2 tasks");
  });

  it("counts nested children for workouts (sessions, exercises, sets)", () => {
    const data = {
      sessions: [
        {
          id: "s1",
          session_date: "2026-08-01",
          name: null,
          category: "Chest",
          created_at: "2026-08-01T00:00:00Z",
          exercises: [
            {
              id: "e1",
              exercise_name: "Bench",
              position: 0,
              created_at: "2026-08-01T00:00:00Z",
              sets: [
                { id: "x1", set_number: 1, weight: 135, reps: 10, notes: null, created_at: "2026-08-01T00:00:00Z" },
                { id: "x2", set_number: 2, weight: 145, reps: 8, notes: null, created_at: "2026-08-01T00:00:00Z" },
              ],
            },
          ],
        },
      ],
    };
    expect(summarizeSection("workouts", data)).toBe("1 session, 1 exercise, 2 sets");
  });

  it("reports a null weight goal distinctly from a set one", () => {
    expect(summarizeSection("weightTracker", { goal: null, entries: [] })).toBe("no goal, 0 entries");
    expect(
      summarizeSection("weightTracker", {
        goal: { goal_weight: 180, target_date: null, updated_at: "2026-08-01T00:00:00Z" },
        entries: [],
      }),
    ).toBe("a goal, 0 entries");
  });

  it("returns a readable error rather than throwing on malformed input", () => {
    expect(() => summarizeSection("journal", { entries: "not an array" })).not.toThrow();
    expect(summarizeSection("journal", { entries: "not an array" })).toBe(
      "Couldn't read this section from the file.",
    );
    expect(summarizeSection("journal", null)).toBe("Couldn't read this section from the file.");
  });
});
