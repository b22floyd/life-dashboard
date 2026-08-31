import { describe, expect, it } from "vitest";
import { getLocalDateString, isValidDateString } from "./date-utils";

describe("getLocalDateString", () => {
  it("formats using the date's local fields, not UTC", () => {
    // Constructed via local-component Date(), which is how every caller in
    // this app builds dates — never via UTC-based ISO string parsing.
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(getLocalDateString(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("pads single-digit month and day", () => {
    expect(getLocalDateString(new Date(2026, 2, 4))).toBe("2026-03-04");
  });

  it("defaults to the current date when called with no argument", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(getLocalDateString()).toBe(expected);
  });
});

describe("isValidDateString", () => {
  it("accepts well-formed yyyy-mm-dd strings", () => {
    expect(isValidDateString("2026-01-05")).toBe(true);
    expect(isValidDateString("2026-12-31")).toBe(true);
  });

  it("rejects malformed or non-date strings", () => {
    expect(isValidDateString("")).toBe(false);
    expect(isValidDateString("2026-1-5")).toBe(false); // not zero-padded
    expect(isValidDateString("01-05-2026")).toBe(false); // wrong order
    expect(isValidDateString("2026/01/05")).toBe(false); // wrong separator
    expect(isValidDateString("not-a-date")).toBe(false);
    // Deliberately a format check only — it doesn't validate calendar
    // correctness (callers rely on this being cheap and purely syntactic).
    expect(isValidDateString("2026-13-40")).toBe(true);
  });
});
