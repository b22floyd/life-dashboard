"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addContact,
  deleteContact,
  logContact,
  updateContact,
  type AddContactState,
} from "@/app/actions/contacts";
import { useHasMounted } from "@/lib/use-has-mounted";
import {
  CONTACT_CATEGORIES,
  computeContactStatus,
  isContactVisible,
  type ContactWithStatus,
} from "@/lib/contacts-utils";
import { ContactItem, type ContactEditInput } from "./ContactItem";

const initialAddState: AddContactState = null;
const CATEGORY_FILTERS = ["All", ...CONTACT_CATEGORIES] as const;
type CategoryFilter = (typeof CATEGORY_FILTERS)[number];

// nextDueAt is an absolute instant, so formatting it is timezone-dependent —
// only called once mounted, same as Routine Cleaning Reminders' equivalent.
function formatNextDue(nextDueAt: string) {
  return new Date(nextDueAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ContactsCardBody({ contacts }: { contacts: ContactWithStatus[] }) {
  const router = useRouter();
  const mounted = useHasMounted();

  const [addState, addFormAction, isAdding] = useActionState(addContact, initialAddState);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [localContacts, setLocalContacts] = useState(contacts);
  // Reset local (optimistic) contact state whenever fresh data arrives from
  // the server, following React's "adjusting state when a prop changes"
  // pattern. Closing the add form here (rather than in the effect below)
  // avoids calling setState synchronously inside an effect — addContact
  // returns null on success, same as its initial state, so there's no other
  // reliable success signal to key off.
  const [handledContacts, setHandledContacts] = useState(contacts);
  if (contacts !== handledContacts) {
    setHandledContacts(contacts);
    setLocalContacts(contacts);
    setShowAddForm(false);
  }

  useEffect(() => {
    if (submittedRef.current && !isAdding) {
      submittedRef.current = false;
      if (!addState?.error) {
        formRef.current?.reset();
      }
    }
  }, [addState, isAdding]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionPending, startActionTransition] = useTransition();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [recentlyContactedExpanded, setRecentlyContactedExpanded] = useState(false);

  function handleDelete(contactId: string) {
    setActionError(null);
    setLocalContacts((current) => current.filter((contact) => contact.id !== contactId));
    startActionTransition(async () => {
      const result = await deleteContact(contactId);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleLogContact(contact: ContactWithStatus) {
    setActionError(null);
    const optimistic = computeContactStatus(contact, new Date().toISOString());
    setLocalContacts((current) =>
      current.map((c) => (c.id === contact.id ? optimistic : c)),
    );
    startActionTransition(async () => {
      const result = await logContact(contact.id);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleUpdateContact(contactId: string, input: ContactEditInput) {
    setActionError(null);
    setLocalContacts((current) =>
      current.map((c) => (c.id === contactId ? { ...c, ...input } : c)),
    );
    startActionTransition(async () => {
      const result = await updateContact(contactId, input);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  const filteredContacts =
    categoryFilter === "All"
      ? localContacts
      : localContacts.filter((contact) => contact.category === categoryFilter);

  // Only actually-due contacts render in the main list — not-yet-due ones
  // still exist and remain editable (keyed off localContacts in the
  // handlers above), they just don't pass the filter until due.
  const dueContacts = filteredContacts.filter((contact) => isContactVisible(contact));

  // The complement that's also been contacted at least once — a contact
  // that's simply never been logged is "due now" and shows up above instead.
  const recentlyContacted = filteredContacts
    .filter((contact) => contact.lastContactedAt !== null && !isContactVisible(contact))
    .sort((a, b) => (a.nextDueAt ?? "").localeCompare(b.nextDueAt ?? ""));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setCategoryFilter(filter)}
            className={
              categoryFilter === filter
                ? "rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }
          >
            {filter}
          </button>
        ))}
      </div>

      {actionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}

      {localContacts.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No contacts yet — add one below.
        </p>
      ) : dueContacts.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Nobody due for a reach-out right now.
        </p>
      ) : (
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {dueContacts.map((contact) => (
            <ContactItem
              key={contact.id}
              contact={contact}
              isPending={isActionPending}
              onLogContact={() => handleLogContact(contact)}
              onUpdateContact={(input) => handleUpdateContact(contact.id, input)}
              onDelete={() => handleDelete(contact.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setRecentlyContactedExpanded((expanded) => !expanded)}
          aria-expanded={recentlyContactedExpanded}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          <span>{recentlyContactedExpanded ? "▾" : "▸"}</span>
          Recently contacted, not due yet
          {recentlyContacted.length > 0 && ` (${recentlyContacted.length})`}
        </button>

        {recentlyContactedExpanded && (
          <div className="mt-3 flex max-h-60 flex-col gap-2 overflow-y-auto">
            {recentlyContacted.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Nobody in this state right now.
              </p>
            ) : (
              recentlyContacted.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                      {contact.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      {contact.category}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {mounted && contact.nextDueAt
                      ? `Next due ${formatNextDue(contact.nextDueAt)}`
                      : "…"}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showAddForm ? (
        <form
          ref={formRef}
          action={addFormAction}
          onSubmit={() => {
            submittedRef.current = true;
          }}
          className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
        >
          <div className="flex gap-2">
            <input
              type="text"
              name="name"
              placeholder="Name"
              required
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
            />
            <select
              name="category"
              defaultValue={CONTACT_CATEGORIES[0]}
              className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-600 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
            >
              {CONTACT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Reach out every
            </label>
            <input
              type="number"
              name="cadenceDays"
              inputMode="numeric"
              min={1}
              defaultValue={30}
              required
              className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">days</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Birthday (optional)
              </label>
              <input
                type="date"
                name="birthday"
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Important date (optional)
              </label>
              <input
                type="date"
                name="importantDate"
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
              />
            </div>
          </div>
          <input
            type="text"
            name="importantDateLabel"
            placeholder="Important date label (e.g. Anniversary)"
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          />
          <textarea
            name="notes"
            rows={2}
            placeholder="Notes (optional)"
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          />
          <textarea
            name="giftIdeas"
            rows={2}
            placeholder="Gift ideas (optional)"
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          />
          {addState?.error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{addState.error}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding}
              className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isAdding ? "Adding…" : "Add Contact"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="self-start rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Add Contact
        </button>
      )}
    </div>
  );
}
