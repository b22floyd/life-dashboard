// @vitest-environment jsdom
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactsCardBody } from "./ContactsCardBody";
import { computeContactStatus, type Contact, type ContactWithStatus } from "@/lib/contacts-utils";

const {
  addContactMock,
  updateContactMock,
  deleteContactMock,
  logContactMock,
  refreshMock,
} = vi.hoisted(() => ({
  addContactMock: vi.fn(),
  updateContactMock: vi.fn(),
  deleteContactMock: vi.fn(),
  logContactMock: vi.fn(),
  refreshMock: vi.fn(),
}));

// Server Actions reach a real Supabase client — mocked the same way every
// other Server-Action-backed component test in this suite does.
vi.mock("@/app/actions/contacts", () => ({
  addContact: addContactMock,
  updateContact: updateContactMock,
  deleteContact: deleteContactMock,
  logContact: logContactMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    name: "Sarah",
    category: "Friends",
    birthday: null,
    importantDate: null,
    importantDateLabel: "",
    notes: "",
    giftIdeas: "",
    cadenceDays: 30,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// Never contacted -> always due, matching computeContactStatus's own
// "no lastContactedAt" branch.
function dueContact(overrides: Partial<Contact> = {}): ContactWithStatus {
  return computeContactStatus(contact(overrides), null);
}

function categoryFilters() {
  // The category filter row is the first flex-wrap group on the card;
  // scoping into it avoids colliding with the category <select> inside the
  // add-contact form once it's open.
  return screen.getByRole("button", { name: "All" }).closest("div") as HTMLElement;
}

beforeEach(() => {
  addContactMock.mockReset().mockResolvedValue(null);
  updateContactMock.mockReset();
  deleteContactMock.mockReset();
  logContactMock.mockReset();
  refreshMock.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ContactsCardBody", () => {
  it("shows an empty state with no contacts", () => {
    render(<ContactsCardBody contacts={[]} />);
    expect(screen.getByText(/No contacts yet/)).toBeInTheDocument();
  });

  it("shows due contacts in the main list and filters by category", async () => {
    const user = userEvent.setup();
    const sarah = dueContact({ id: "c1", name: "Sarah", category: "Friends" });
    const bob = dueContact({ id: "c2", name: "Bob", category: "Work" });
    render(<ContactsCardBody contacts={[sarah, bob]} />);

    expect(screen.getByText("Sarah")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    await user.click(within(categoryFilters()).getByRole("button", { name: "Work" }));
    expect(screen.queryByText("Sarah")).not.toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("says nobody's due when contacts exist but none are due", () => {
    const notDue: ContactWithStatus = computeContactStatus(
      contact({ cadenceDays: 30 }),
      new Date().toISOString(),
    );
    render(<ContactsCardBody contacts={[notDue]} />);
    expect(screen.getByText(/Nobody due for a reach-out right now/)).toBeInTheDocument();
  });

  // This is the exact regression documented in ContactItem.tsx: an earlier
  // version kept an optimistic copy of the contact inside ContactItem that
  // updated its own rendering but never reached the parent's due-status
  // filter, so a just-logged contact stayed stuck in the due-only list.
  it("removes a contact from the due list immediately after logging it", async () => {
    logContactMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    const sarah = dueContact({ id: "c1", name: "Sarah", cadenceDays: 30 });
    render(<ContactsCardBody contacts={[sarah]} />);

    expect(screen.getByText("Sarah")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log Contact" }));

    // No refetch, no refresh resolution needed — the optimistic status
    // recompute alone must be enough to drop it from the due list.
    expect(screen.getByText(/Nobody due for a reach-out right now/)).toBeInTheDocument();
    expect(logContactMock).toHaveBeenCalledWith("c1");
  });

  it("moves a just-logged contact into Recently Contacted", async () => {
    logContactMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    const sarah = dueContact({ id: "c1", name: "Sarah", cadenceDays: 30 });
    render(<ContactsCardBody contacts={[sarah]} />);

    await user.click(screen.getByRole("button", { name: "Log Contact" }));
    await user.click(screen.getByRole("button", { name: /Recently contacted/ }));

    expect(screen.getByText("Sarah")).toBeInTheDocument();
  });

  it("edits a contact via ContactItem's inline form, updating optimistically without a refresh", async () => {
    updateContactMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    const sarah = dueContact({ id: "c1", name: "Sarah", category: "Friends" });
    render(<ContactsCardBody contacts={[sarah]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = screen.getByPlaceholderText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Sarah Connor");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Optimistic: renders immediately, before the Server Action resolves.
    expect(screen.getByText("Sarah Connor")).toBeInTheDocument();
    expect(updateContactMock).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ name: "Sarah Connor", category: "Friends" }),
    );
  });

  it("asks for confirmation before deleting a contact, and does nothing if declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    const sarah = dueContact({ id: "c1", name: "Sarah" });
    render(<ContactsCardBody contacts={[sarah]} />);

    await user.click(screen.getByRole("button", { name: "Delete contact" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteContactMock).not.toHaveBeenCalled();
    expect(screen.getByText("Sarah")).toBeInTheDocument();
  });

  it("deletes a contact optimistically once confirmed", async () => {
    deleteContactMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    const sarah = dueContact({ id: "c1", name: "Sarah" });
    render(<ContactsCardBody contacts={[sarah]} />);

    await user.click(screen.getByRole("button", { name: "Delete contact" }));

    expect(deleteContactMock).toHaveBeenCalledWith("c1");
    await waitFor(() => expect(screen.queryByText("Sarah")).not.toBeInTheDocument());
  });

  it("shows the add-contact form on request and submits it via the addContact Server Action", async () => {
    const user = userEvent.setup();
    render(<ContactsCardBody contacts={[]} />);

    await user.click(screen.getByRole("button", { name: "+ Add Contact" }));
    await user.type(screen.getByPlaceholderText("Name"), "New Friend");
    await user.click(screen.getByRole("button", { name: "Add Contact" }));

    await waitFor(() => expect(addContactMock).toHaveBeenCalledTimes(1));
  });

  it("cancelling the add-contact form hides it without submitting", async () => {
    const user = userEvent.setup();
    render(<ContactsCardBody contacts={[]} />);

    await user.click(screen.getByRole("button", { name: "+ Add Contact" }));
    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();
    expect(addContactMock).not.toHaveBeenCalled();
  });
});
