import { describe, expect, it } from "vitest";
import { buildDailyReminderContent } from "./push-notification-content";
import type { CleaningTaskWithStatus } from "./cleaning-utils";
import type { ContactWithStatus } from "./contacts-utils";
import type { HabitWithCompletions } from "./habit-utils";

function habit(name: string, completedDates: string[]): HabitWithCompletions {
  return { id: name, name, position: 0, created_at: "2026-01-01T00:00:00Z", completedDates };
}

function cleaningTask(name: string, isDue: boolean): CleaningTaskWithStatus {
  return {
    id: name,
    name,
    frequency: "weekly",
    createdAt: "2026-01-01T00:00:00Z",
    lastCompletedAt: null,
    isDue,
    isHidden: false,
    daysUntilDue: isDue ? null : 3,
    nextDueAt: "2026-08-16T00:00:00Z",
  };
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
    const cleaningTasks = [cleaningTask("Vacuum", false)];
    expect(buildDailyReminderContent(habits, "2026-08-15", contacts, cleaningTasks)).toBeNull();
  });

  it("returns null for entirely empty habits, contacts, and cleaning tasks", () => {
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

  it("counts only due cleaning tasks, not ones that aren't due yet", () => {
    const cleaningTasks = [cleaningTask("Vacuum", true), cleaningTask("Dust", false)];
    const result = buildDailyReminderContent([], "2026-08-15", [], cleaningTasks);
    expect(result?.body).toBe("1 cleaning task due");
  });

  it("pluralizes correctly for multiple due cleaning tasks", () => {
    const cleaningTasks = [cleaningTask("Vacuum", true), cleaningTask("Mop", true)];
    const result = buildDailyReminderContent([], "2026-08-15", [], cleaningTasks);
    expect(result?.body).toBe("2 cleaning tasks due");
  });

  it("combines habits, cleaning tasks, and contacts in a fixed order when all three are present", () => {
    const habits = [habit("Meditate", [])];
    const cleaningTasks = [cleaningTask("Vacuum", true)];
    const contacts = [contact("Sarah", true)];
    const result = buildDailyReminderContent(habits, "2026-08-15", contacts, cleaningTasks);
    expect(result?.body).toBe("1 habit due today · 1 cleaning task due · 1 contact to reach out to");
  });

  it("always uses the same title", () => {
    const result = buildDailyReminderContent([habit("Meditate", [])], "2026-08-15", []);
    expect(result?.title).toBe("Life Dashboard");
  });
});
