import { describe, expect, it } from "vitest";
import { buildDailyReminderContent } from "./push-notification-content";
import type { ContactWithStatus } from "./contacts-utils";
import type { HabitWithCompletions } from "./habit-utils";

function habit(name: string, completedDates: string[]): HabitWithCompletions {
  return { id: name, name, position: 0, created_at: "2026-01-01T00:00:00Z", completedDates };
}

function contact(name: string, isDue: boolean): ContactWithStatus {
  return {
    id: name,
    name,
    category: "Friends",
    birthday: null,
    importantDate: null,
    importantDateLabel: "",
    notes: "",
    giftIdeas: "",
    cadenceDays: 30,
    createdAt: "2026-01-01T00:00:00Z",
    lastContactedAt: null,
    isDue,
    daysSinceContacted: null,
    daysUntilDue: null,
    nextDueAt: null,
  };
}

describe("buildDailyReminderContent", () => {
  it("returns null when everything is done and nobody is due", () => {
    const habits = [habit("Meditate", ["2026-08-15"])];
    const contacts = [contact("Sarah", false)];
    expect(buildDailyReminderContent(habits, "2026-08-15", contacts)).toBeNull();
  });

  it("returns null for entirely empty habits and contacts", () => {
    expect(buildDailyReminderContent([], "2026-08-15", [])).toBeNull();
  });

  it("counts only habits not yet completed today", () => {
    const habits = [habit("Meditate", ["2026-08-15"]), habit("Run", [])];
    const result = buildDailyReminderContent(habits, "2026-08-15", []);
    expect(result).not.toBeNull();
    expect(result?.body).toBe("1 habit due today");
  });

  it("pluralizes correctly for multiple outstanding habits", () => {
    const habits = [habit("Meditate", []), habit("Run", [])];
    const result = buildDailyReminderContent(habits, "2026-08-15", []);
    expect(result?.body).toBe("2 habits due today");
  });

  it("counts only due contacts, not ones that aren't due yet", () => {
    const contacts = [contact("Sarah", true), contact("Mike", false)];
    const result = buildDailyReminderContent([], "2026-08-15", contacts);
    expect(result?.body).toBe("1 contact to reach out to");
  });

  it("combines habits and contacts into one message when both are present", () => {
    const habits = [habit("Meditate", [])];
    const contacts = [contact("Sarah", true), contact("Mike", true)];
    const result = buildDailyReminderContent(habits, "2026-08-15", contacts);
    expect(result?.body).toBe("1 habit due today · 2 contacts to reach out to");
  });

  it("always uses the same title", () => {
    const result = buildDailyReminderContent([habit("Meditate", [])], "2026-08-15", []);
    expect(result?.title).toBe("Life Dashboard");
  });
});
