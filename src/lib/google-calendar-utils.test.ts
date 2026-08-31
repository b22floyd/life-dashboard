import { describe, expect, it } from "vitest";
import {
  formatEventTime,
  isEventStartingSoon,
  isSameLocalDay,
  parseEventDate,
  type CalendarEvent,
} from "./google-calendar-utils";

function allDayEvent(start: string): CalendarEvent {
  return { id: "1", title: "Test", start, isAllDay: true };
}

function timedEvent(start: string): CalendarEvent {
  return { id: "1", title: "Test", start, isAllDay: false };
}

describe("parseEventDate", () => {
  it("parses an all-day event's yyyy-mm-dd string as a local date, not UTC midnight", () => {
    // The exact regression this function exists to prevent: new Date("2024-03-15")
    // parses as UTC midnight, which rolls back to March 14th in any timezone
    // west of UTC. Comparing against an explicitly-local Date catches that.
    const parsed = parseEventDate(allDayEvent("2024-03-15"));
    const expected = new Date(2024, 2, 15);
    expect(parsed.getFullYear()).toBe(expected.getFullYear());
    expect(parsed.getMonth()).toBe(expected.getMonth());
    expect(parsed.getDate()).toBe(expected.getDate());
  });

  it("parses a timed event's ISO datetime normally", () => {
    const iso = new Date(2024, 2, 15, 14, 30).toISOString();
    const parsed = parseEventDate(timedEvent(iso));
    expect(parsed.getTime()).toBe(new Date(iso).getTime());
  });
});

describe("isSameLocalDay", () => {
  it("returns true for two Dates on the same local day at different times", () => {
    expect(isSameLocalDay(new Date(2024, 5, 1, 8), new Date(2024, 5, 1, 23))).toBe(true);
  });

  it("returns false for two Dates on different days", () => {
    expect(isSameLocalDay(new Date(2024, 5, 1, 23), new Date(2024, 5, 2, 0))).toBe(false);
  });

  it("returns false across a month boundary even with the same day-of-month", () => {
    expect(isSameLocalDay(new Date(2024, 4, 1), new Date(2024, 5, 1))).toBe(false);
  });
});

describe("formatEventTime", () => {
  it("returns 'All day' for an all-day event regardless of its date value", () => {
    expect(formatEventTime(allDayEvent("2024-03-15"))).toBe("All day");
  });

  it("formats a timed event's clock time in the runner's local timezone", () => {
    const iso = new Date(2024, 2, 15, 14, 30).toISOString();
    const expected = new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    expect(formatEventTime(timedEvent(iso))).toBe(expected);
  });
});

describe("isEventStartingSoon", () => {
  const now = new Date(2024, 2, 15, 12, 0, 0);

  it("is false for an all-day event no matter when it falls", () => {
    expect(isEventStartingSoon(allDayEvent("2024-03-15"), now)).toBe(false);
  });

  it("is true for an event starting within the default 60-minute window", () => {
    const start = new Date(now.getTime() + 30 * 60_000).toISOString();
    expect(isEventStartingSoon(timedEvent(start), now)).toBe(true);
  });

  it("is true right at the 60-minute boundary", () => {
    const start = new Date(now.getTime() + 60 * 60_000).toISOString();
    expect(isEventStartingSoon(timedEvent(start), now)).toBe(true);
  });

  it("is false just past the 60-minute boundary", () => {
    const start = new Date(now.getTime() + 61 * 60_000).toISOString();
    expect(isEventStartingSoon(timedEvent(start), now)).toBe(false);
  });

  it("is true for an event that started up to 30 minutes ago (grace window)", () => {
    const start = new Date(now.getTime() - 29 * 60_000).toISOString();
    expect(isEventStartingSoon(timedEvent(start), now)).toBe(true);
  });

  it("is false for an event that started more than 30 minutes ago", () => {
    const start = new Date(now.getTime() - 31 * 60_000).toISOString();
    expect(isEventStartingSoon(timedEvent(start), now)).toBe(false);
  });

  it("respects a custom windowMinutes argument", () => {
    const start = new Date(now.getTime() + 90 * 60_000).toISOString();
    expect(isEventStartingSoon(timedEvent(start), now, 60)).toBe(false);
    expect(isEventStartingSoon(timedEvent(start), now, 120)).toBe(true);
  });
});
