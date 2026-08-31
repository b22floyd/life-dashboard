// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataRestorePanel } from "./DataRestorePanel";

const { restoreDataSectionMock } = vi.hoisted(() => ({ restoreDataSectionMock: vi.fn() }));

// restoreDataSection is a Server Action backed by a Supabase client that
// reads request cookies via next/headers — none of which exists outside a
// real Next request, so it has to be mocked for a component-level test the
// same way any network/server boundary would be.
vi.mock("@/app/actions/restore", () => ({
  restoreDataSection: restoreDataSectionMock,
}));

function validBackup(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    exportedAt: "2024-01-01T00:00:00.000Z",
    journal: { entries: [] },
    workouts: { sessions: [] },
    habits: { habits: [] },
    mealPlan: { entries: [] },
    grocery: { items: [], staples: [] },
    cleaning: { tasks: [] },
    annualGoals: { goals: [] },
    contacts: { contacts: [] },
    weightTracker: { goal: null, entries: [] },
    personalTasks: { tasks: [{ id: "t1", content: "Buy milk", created_at: "2024-01-01T00:00:00.000Z" }] },
    ...overrides,
  };
}

function backupFile(content: unknown) {
  return new File([JSON.stringify(content)], "backup.json", { type: "application/json" });
}

async function uploadBackup(content: unknown) {
  const user = userEvent.setup();
  render(<DataRestorePanel />);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, backupFile(content));
  return user;
}

afterEach(() => {
  cleanup();
  restoreDataSectionMock.mockReset();
});

describe("DataRestorePanel", () => {
  it("shows an error for a file that isn't valid JSON", async () => {
    const user = userEvent.setup();
    render(<DataRestorePanel />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["not json"], "backup.json", { type: "application/json" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/isn't valid json/i));
  });

  it("shows an error for a backup made with a different export version", async () => {
    await uploadBackup(validBackup({ version: 99 }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/different export format/i),
    );
  });

  it("shows an error for JSON that isn't a recognizable backup at all", async () => {
    await uploadBackup({ foo: "bar" });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/doesn't look like a life-dashboard backup/i),
    );
  });

  it("lists every restorable section with a summary once a valid backup loads", async () => {
    await uploadBackup(validBackup());
    expect(await screen.findByText("Personal Tasks")).toBeInTheDocument();
    expect(screen.getByText("1 task")).toBeInTheDocument();
    expect(screen.getByText("Journal")).toBeInTheDocument();
    expect(screen.getAllByText("0 entries").length).toBeGreaterThan(0);
  });

  it("asks for confirmation before restoring, naming the section", async () => {
    const user = await uploadBackup(validBackup());
    await screen.findByText("Personal Tasks");
    const restoreButtons = screen.getAllByRole("button", { name: "Restore" });
    await user.click(restoreButtons[0]);
    expect(screen.getByRole("alert")).toHaveTextContent(/replaces your current/i);
  });

  it("cancelling the confirmation returns to the idle Restore button", async () => {
    const user = await uploadBackup(validBackup());
    await screen.findByText("Personal Tasks");
    await user.click(screen.getAllByRole("button", { name: "Restore" })[0]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Restore" }).length).toBeGreaterThan(0);
  });

  it("confirming calls restoreDataSection and shows Restored on success", async () => {
    restoreDataSectionMock.mockResolvedValue({ message: "Restored 1 task." });
    const user = await uploadBackup(validBackup());
    await screen.findByText("Personal Tasks");
    await user.click(screen.getAllByRole("button", { name: "Restore" })[0]);
    await user.click(screen.getByRole("button", { name: /Yes, replace my/i }));

    await waitFor(() => expect(screen.getByText("Restored")).toBeInTheDocument());
    expect(restoreDataSectionMock).toHaveBeenCalledTimes(1);
  });

  it("shows the error message and lets the Restore button be retried on failure", async () => {
    restoreDataSectionMock.mockResolvedValue({ error: "Something went wrong." });
    const user = await uploadBackup(validBackup());
    await screen.findByText("Personal Tasks");
    await user.click(screen.getAllByRole("button", { name: "Restore" })[0]);
    await user.click(screen.getByRole("button", { name: /Yes, replace my/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong."),
    );
  });

  it("disables the Restore button for a section whose data doesn't match its schema", async () => {
    await uploadBackup(validBackup({ personalTasks: { tasks: [{ content: "missing id/created_at" }] } }));
    await screen.findByText("Personal Tasks");
    const personalTasksItem = screen.getByText("Personal Tasks").closest("li")!;
    expect(personalTasksItem).toHaveTextContent(/couldn't read this section/i);
    const restoreButtonInItem = personalTasksItem.querySelector("button");
    expect(restoreButtonInItem).toBeDisabled();
  });
});
