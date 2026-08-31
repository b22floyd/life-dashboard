import { describe, expect, it } from "vitest";
import {
  estimateOneRepMax,
  getExerciseNames,
  getExerciseUsage,
  getOneRepMaxSeries,
  normalizeExerciseName,
  suggestExerciseMergeGroups,
  type WorkoutSession,
} from "./workout-utils";

describe("normalizeExerciseName", () => {
  it.each([
    ["Bench Press", "bench press"],
    ["Bench Press", "  Bench   Press  "],
    ["Bench Press", "Bench-Press"],
    ["Bench Press", "Bench Presses"],
    ["BB Bench Press", "Barbell Bench Press"],
    ["DB Curl", "Dumbbell Curls"],
    ["Lateral Raise", "Lateral Raises"],
    ["Incline Bench Press", "Bench Press Incline"],
    ["OHP", "Overhead Press"],
    ["RDL", "Romanian Deadlift"],
    ["Bicep Curl", "Bicep Curls"],
    ["Lunge", "Lunges"],
  ])("treats %s and %s as the same exercise", (a, b) => {
    expect(normalizeExerciseName(a)).toBe(normalizeExerciseName(b));
  });

  // Over-merging is the dangerous failure mode here — these must never
  // collapse together no matter how the matching heuristic evolves.
  it.each([
    ["Bench Press", "Incline Bench Press"],
    ["Squat", "Front Squat"],
    ["Deadlift", "Romanian Deadlift"],
    ["Overhead Press", "Bench Press"],
    ["Bicep Curl", "Hammer Curl"],
    ["Leg Press", "Leg Curl"],
  ])("keeps %s and %s distinct", (a, b) => {
    expect(normalizeExerciseName(a)).not.toBe(normalizeExerciseName(b));
  });

  it("does not mangle 'press' via the plural stemmer", () => {
    expect(normalizeExerciseName("Press")).toBe("press");
    expect(normalizeExerciseName("Presses")).toBe("press");
  });
});

function session(
  id: string,
  exercises: { name: string; sets: { weight: number; reps: number }[] }[],
): WorkoutSession {
  return {
    id,
    session_date: "2026-08-01",
    name: null,
    category: "Chest",
    created_at: "",
    exercises: exercises.map((exercise, i) => ({
      id: `${id}-ex${i}`,
      exercise_name: exercise.name,
      position: i,
      sets: exercise.sets.map((set, j) => ({
        id: `${id}-ex${i}-set${j}`,
        set_number: j + 1,
        weight: set.weight,
        reps: set.reps,
      })),
    })),
  };
}

describe("getExerciseUsage", () => {
  it("keeps distinct casings as separate entries with their own counts", () => {
    const sessions = [
      session("s1", [
        { name: "Bench Press", sets: [{ weight: 135, reps: 10 }, { weight: 145, reps: 8 }] },
        { name: "bench press", sets: [{ weight: 155, reps: 6 }] },
      ]),
      session("s2", [{ name: "Bench Press", sets: [{ weight: 135, reps: 10 }] }]),
    ];

    const usage = getExerciseUsage(sessions);
    const byName = Object.fromEntries(usage.map((u) => [u.name, u]));

    expect(Object.keys(byName).sort()).toEqual(["Bench Press", "bench press"]);
    expect(byName["Bench Press"]).toEqual({ name: "Bench Press", sessionCount: 2, setCount: 3 });
    expect(byName["bench press"]).toEqual({ name: "bench press", sessionCount: 1, setCount: 1 });
  });

  it("counts the same exercise appearing twice in one session as one session, sets summed", () => {
    const sessions = [
      session("s1", [
        { name: "Row", sets: [{ weight: 100, reps: 5 }] },
        { name: "Row", sets: [{ weight: 110, reps: 5 }] },
      ]),
    ];
    expect(getExerciseUsage(sessions)).toEqual([{ name: "Row", sessionCount: 1, setCount: 2 }]);
  });

  it("excludes blank/whitespace-only exercise names", () => {
    const sessions = [session("s1", [{ name: "   ", sets: [{ weight: 1, reps: 1 }] }])];
    expect(getExerciseUsage(sessions)).toEqual([]);
  });

  it("keys on the exact stored string, including surrounding whitespace", () => {
    // Whitespace variants must stay distinguishable so a merge action can
    // target the exact row that needs renaming.
    const sessions = [
      session("s1", [
        { name: "Bench Press", sets: [{ weight: 100, reps: 5 }] },
        { name: "Bench Press ", sets: [{ weight: 100, reps: 5 }] },
      ]),
    ];
    const names = getExerciseUsage(sessions).map((u) => u.name);
    expect(names).toContain("Bench Press");
    expect(names).toContain("Bench Press ");
  });
});

describe("suggestExerciseMergeGroups", () => {
  it("groups variants and defaults the canonical name to the most-used spelling", () => {
    const usage = [
      { name: "bench press", sessionCount: 1, setCount: 1 },
      { name: "Bench Press", sessionCount: 2, setCount: 3 },
    ];
    const suggestions = suggestExerciseMergeGroups(usage);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].names.slice().sort()).toEqual(["Bench Press", "bench press"].sort());
    expect(suggestions[0].canonical).toBe("Bench Press");
  });

  it("produces no suggestions when every exercise is genuinely distinct", () => {
    const usage = [
      { name: "Bench Press", sessionCount: 3, setCount: 9 },
      { name: "Incline Bench Press", sessionCount: 2, setCount: 6 },
      { name: "Squat", sessionCount: 4, setCount: 12 },
    ];
    expect(suggestExerciseMergeGroups(usage)).toEqual([]);
  });

  it("breaks a canonical tie on setCount, not alphabetical order", () => {
    const usage = [
      { name: "ab wheel", sessionCount: 1, setCount: 2 },
      { name: "Ab Wheel", sessionCount: 5, setCount: 15 },
    ];
    expect(suggestExerciseMergeGroups(usage)[0].canonical).toBe("Ab Wheel");
  });

  it("groups three or more variants into a single suggestion", () => {
    const usage = [
      { name: "OHP", sessionCount: 1, setCount: 2 },
      { name: "Overhead Press", sessionCount: 3, setCount: 9 },
      { name: "overhead presses", sessionCount: 1, setCount: 3 },
    ];
    const suggestions = suggestExerciseMergeGroups(usage);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].names).toHaveLength(3);
    expect(suggestions[0].canonical).toBe("Overhead Press");
  });
});

describe("getExerciseNames", () => {
  it("folds case variants together for display, keeping first-seen casing", () => {
    const sessions = [
      session("s1", [{ name: "Bench Press", sets: [{ weight: 1, reps: 1 }] }]),
      session("s2", [{ name: "bench press", sets: [{ weight: 1, reps: 1 }] }]),
      session("s3", [{ name: "Squat", sets: [{ weight: 1, reps: 1 }] }]),
    ];
    expect(getExerciseNames(sessions)).toEqual(["Bench Press", "Squat"]);
  });
});

describe("estimateOneRepMax", () => {
  it("applies the Epley formula", () => {
    expect(estimateOneRepMax(135, 10)).toBeCloseTo(135 * (1 + 10 / 30));
  });

  it("equals the raw weight at 0 reps", () => {
    expect(estimateOneRepMax(135, 0)).toBe(135);
  });
});

describe("getOneRepMaxSeries", () => {
  it("picks the best set per session by estimated 1RM, not raw weight", () => {
    const sessions = [
      session("s1", [
        {
          name: "Bench Press",
          // 100x10 -> 133.3 est 1RM; 120x2 -> 128 est 1RM — first set wins
          // despite being lighter, since it produces the higher estimate.
          sets: [{ weight: 100, reps: 10 }, { weight: 120, reps: 2 }],
        },
      ]),
    ];
    const series = getOneRepMaxSeries(sessions, "Bench Press");
    expect(series).toHaveLength(1);
    expect(series[0].oneRepMax).toBeCloseTo(estimateOneRepMax(100, 10));
  });

  it("sorts chronologically regardless of input session order", () => {
    const sessions = [
      { ...session("s2", [{ name: "Squat", sets: [{ weight: 200, reps: 5 }] }]), session_date: "2026-08-10" },
      { ...session("s1", [{ name: "Squat", sets: [{ weight: 195, reps: 5 }] }]), session_date: "2026-08-01" },
    ];
    const series = getOneRepMaxSeries(sessions, "Squat");
    expect(series.map((p) => p.date)).toEqual(["2026-08-01", "2026-08-10"]);
  });

  it("excludes sessions with no matching exercise", () => {
    const sessions = [session("s1", [{ name: "Squat", sets: [{ weight: 200, reps: 5 }] }])];
    expect(getOneRepMaxSeries(sessions, "Bench Press")).toEqual([]);
  });

  it("matches exercise names case-insensitively", () => {
    const sessions = [session("s1", [{ name: "SQUAT", sets: [{ weight: 200, reps: 5 }] }])];
    expect(getOneRepMaxSeries(sessions, "squat")).toHaveLength(1);
  });
});
