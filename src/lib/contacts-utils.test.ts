import { describe, expect, it } from "vitest";
import { computeContactStatus, isContactVisible, type Contact } from "./contacts-utils";

function contact(cadenceDays: number): Contact {
  return {
    id: "c1",
    name: "Test Contact",
    category: "Friends",
    birthday: null,
    importantDate: null,
    importantDateLabel: "",
    notes: "",
    giftIdeas: "",
    cadenceDays,
    createdAt: new Date(2024, 0, 1).toISOString(),
  };
}

describe("computeContactStatus", () => {
  it("is due immediately when never contacted", () => {
    const result = computeContactStatus(contact(30), null);
    expect(result.isDue).toBe(true);
    expect(result.daysSinceContacted).toBeNull();
    expect(result.daysUntilDue).toBeNull();
    expect(result.nextDueAt).toBeNull();
  });

  it("is not due when well within the cadence window", () => {
    const now = new Date(2026, 7, 15);
    const lastContactedAt = new Date(2026, 7, 10).toISOString(); // 5 days ago
    const result = computeContactStatus(contact(30), lastContactedAt, now);
    expect(result.isDue).toBe(false);
    expect(result.daysSinceContacted).toBe(5);
    expect(result.daysUntilDue).toBe(25);
  });

  it("is due exactly at the cadence boundary", () => {
    const now = new Date(2026, 7, 15);
    const lastContactedAt = new Date(2026, 6, 16).toISOString(); // exactly 30 days ago
    const result = computeContactStatus(contact(30), lastContactedAt, now);
    expect(result.isDue).toBe(true);
  });

  it("is due when past the cadence window (overdue)", () => {
    const now = new Date(2026, 7, 15);
    const lastContactedAt = new Date(2026, 5, 1).toISOString(); // ~75 days ago
    const result = computeContactStatus(contact(30), lastContactedAt, now);
    expect(result.isDue).toBe(true);
    expect(result.daysUntilDue).toBeNull();
  });

  it("computes nextDueAt as lastContactedAt plus the cadence, regardless of due-ness", () => {
    const lastContactedAt = new Date(2026, 7, 1).toISOString();
    const result = computeContactStatus(contact(14), lastContactedAt, new Date(2026, 7, 5));
    expect(result.nextDueAt).toBe(new Date(2026, 7, 15).toISOString());
  });
});

describe("isContactVisible", () => {
  it("mirrors isDue exactly — no separate coming-due-soon bucket", () => {
    const due = computeContactStatus(contact(30), null);
    expect(isContactVisible(due)).toBe(true);

    const notDue = computeContactStatus(
      contact(30),
      new Date(2026, 7, 10).toISOString(),
      new Date(2026, 7, 12),
    );
    expect(isContactVisible(notDue)).toBe(false);
  });
});
