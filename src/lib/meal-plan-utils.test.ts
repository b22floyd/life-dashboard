import { describe, expect, it } from "vitest";
import { addDays, getPreviousWeekStartDate, getWeekStartDate, slotKey } from "./meal-plan-utils";

describe("getWeekStartDate", () => {
  it("returns the same date when it's already a Sunday", () => {
    // 2026-08-16 is a Sunday.
    expect(getWeekStartDate("2026-08-16")).toBe("2026-08-16");
  });

  it("walks back to the preceding Sunday for any other day of the week", () => {
    // 2026-08-15 is a Saturday; the week containing it starts Sunday 08-09.
    expect(getWeekStartDate("2026-08-15")).toBe("2026-08-09");
    // 2026-08-17 is a Monday; the week containing it starts Sunday 08-16.
    expect(getWeekStartDate("2026-08-17")).toBe("2026-08-16");
  });

  it("handles a week start that crosses a month boundary", () => {
    // 2026-09-01 is a Tuesday; its week starts Sunday 2026-08-30.
    expect(getWeekStartDate("2026-09-01")).toBe("2026-08-30");
  });
});

describe("getPreviousWeekStartDate", () => {
  it("subtracts exactly 7 days", () => {
    expect(getPreviousWeekStartDate("2026-08-16")).toBe("2026-08-09");
  });

  it("handles crossing a month/year boundary", () => {
    expect(getPreviousWeekStartDate("2026-01-04")).toBe("2025-12-28");
  });
});

describe("addDays", () => {
  it("adds and subtracts across month boundaries", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
    expect(addDays("2026-09-02", -3)).toBe("2026-08-30");
  });

  it("handles a leap-year February correctly", () => {
    // 2028 is a leap year.
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });
});

describe("slotKey", () => {
  it("combines day and slot into a stable, distinct key", () => {
    expect(slotKey("Monday", "breakfast")).toBe("Monday-breakfast");
    expect(slotKey("Monday", "lunch")).not.toBe(slotKey("Tuesday", "lunch"));
  });
});
