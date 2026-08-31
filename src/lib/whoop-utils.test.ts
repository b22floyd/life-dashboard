import { describe, expect, it } from "vitest";
import { formatSleepDuration, recoveryColorClass } from "./whoop-utils";

describe("formatSleepDuration", () => {
  it("formats a whole number of hours with no leftover minutes", () => {
    expect(formatSleepDuration(8 * 60 * 60_000)).toBe("8h 0m");
  });

  it("formats hours and minutes together", () => {
    expect(formatSleepDuration(7 * 60 * 60_000 + 23 * 60_000)).toBe("7h 23m");
  });

  it("rounds to the nearest minute rather than truncating", () => {
    // 90,000ms past 7h23m is 1.5 minutes — rounds up to 7h25m, not down to 7h23m.
    expect(formatSleepDuration(7 * 60 * 60_000 + 23 * 60_000 + 90_000)).toBe("7h 25m");
  });

  it("handles under an hour", () => {
    expect(formatSleepDuration(45 * 60_000)).toBe("0h 45m");
  });
});

describe("recoveryColorClass", () => {
  it("is green at and above 67", () => {
    expect(recoveryColorClass(67)).toContain("green");
    expect(recoveryColorClass(100)).toContain("green");
  });

  it("is yellow from 34 up to (but not including) 67", () => {
    expect(recoveryColorClass(34)).toContain("yellow");
    expect(recoveryColorClass(66)).toContain("yellow");
  });

  it("is red below 34", () => {
    expect(recoveryColorClass(33)).toContain("red");
    expect(recoveryColorClass(0)).toContain("red");
  });
});
