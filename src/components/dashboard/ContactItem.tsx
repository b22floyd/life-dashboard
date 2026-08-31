"use client";

import { useState } from "react";
import {
  CONTACT_CATEGORIES,
  type ContactCategory,
  type ContactWithStatus,
} from "@/lib/contacts-utils";

function statusLabel(contact: ContactWithStatus): string {
  if (contact.lastContactedAt === null) return "never contacted";
  if (contact.isDue) return `contacted ${contact.daysSinceContacted}d ago`;
  return `contacted ${contact.daysSinceContacted}d ago, due in ${contact.daysUntilDue}d`;
}

// Birthday/important date are date-only strings, formatted via the same
// self-consistent local round trip used for Journal/Weight Training dates —
// no mount-gating needed since it's a calendar date, not an absolute instant.
function formatDateBadge(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export type ContactEditInput = {
  name: string;
  category: ContactCategory;
  birthday: string | null;
  importantDate: string | null;
  importantDateLabel: string;
  notes: string;
  giftIdeas: string;
  cadenceDays: number;
};

// This component is purely presentational plus its own edit-form UI state —
// the actual contact data and every mutation (log/update/delete) live in
// ContactsCardBody's localContacts, so due/visibility filtering there always
// sees the latest state. An earlier version kept an optimistic copy of the
// contact inside this component instead, which updated its own rendering
// correctly but never reached the parent's due-status filter — logging a
// contact made it show "Not due yet" in place while staying stuck in the
// main (due-only) list until the next full refresh.
export function ContactItem({
  contact,
  isPending,
  onLogContact,
  onUpdateContact,
  onDelete,
}: {
  contact: ContactWithStatus;
  isPending: boolean;
  onLogContact: () => void;
  onUpdateContact: (input: ContactEditInput) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(contact.name);
  const [editCategory, setEditCategory] = useState<ContactCategory>(contact.category);
  const [editBirthday, setEditBirthday] = useState(contact.birthday ?? "");
  const [editImportantDate, setEditImportantDate] = useState(contact.importantDate ?? "");
  const [editImportantDateLabel, setEditImportantDateLabel] = useState(contact.importantDateLabel);
  const [editNotes, setEditNotes] = useState(contact.notes);
  const [editGiftIdeas, setEditGiftIdeas] = useState(contact.giftIdeas);
  const [editCadenceDays, setEditCadenceDays] = useState(String(contact.cadenceDays));
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEditing() {
    setEditName(contact.name);
    setEditCategory(contact.category);
    setEditBirthday(contact.birthday ?? "");
    setEditImportantDate(contact.importantDate ?? "");
    setEditImportantDateLabel(contact.importantDateLabel);
    setEditNotes(contact.notes);
    setEditGiftIdeas(contact.giftIdeas);
    setEditCadenceDays(String(contact.cadenceDays));
    setSaveError(null);
    setIsEditing(true);
  }

  function handleSave() {
    const name = editName.trim();
    const cadenceDays = Number(editCadenceDays);
    if (!name) {
      setSaveError("Name can't be empty.");
      return;
    }
    if (!Number.isFinite(cadenceDays) || cadenceDays <= 0) {
      setSaveError("Enter a valid reach-out cadence (in days).");
      return;
    }
    setSaveError(null);
    setIsEditing(false);
    onUpdateContact({
      name,
      category: editCategory,
      birthday: editBirthday || null,
      importantDate: editImportantDate || null,
      importantDateLabel: editImportantDateLabel.trim(),
      notes: editNotes.trim(),
      giftIdeas: editGiftIdeas.trim(),
      cadenceDays,
    });
  }

  return (
    <div
      data-testid={`contact-${contact.id}`}
      className="flex flex-col gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
    >
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as ContactCategory)}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
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
              inputMode="numeric"
              min={1}
              value={editCadenceDays}
              onChange={(e) => setEditCadenceDays(e.target.value)}
              className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">days</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Birthday
              </label>
              <input
                type="date"
                value={editBirthday}
                onChange={(e) => setEditBirthday(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Important date
              </label>
              <input
                type="date"
                value={editImportantDate}
                onChange={(e) => setEditImportantDate(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>
          </div>
          <input
            type="text"
            value={editImportantDateLabel}
            onChange={(e) => setEditImportantDateLabel(e.target.value)}
            placeholder="Important date label (e.g. Anniversary)"
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
          />
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={2}
            placeholder="Notes"
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
          />
          <textarea
            value={editGiftIdeas}
            onChange={(e) => setEditGiftIdeas(e.target.value)}
            rows={2}
            placeholder="Gift ideas"
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
          />
          {saveError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {contact.name}
              </span>
              <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {contact.category}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={startEditing}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete contact"
                className="text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </div>

          {(contact.birthday || contact.importantDate) && (
            <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              {contact.birthday && <span>🎂 {formatDateBadge(contact.birthday)}</span>}
              {contact.importantDate && (
                <span>
                  📅 {formatDateBadge(contact.importantDate)}
                  {contact.importantDateLabel && ` — ${contact.importantDateLabel}`}
                </span>
              )}
            </div>
          )}

          <p
            className={
              contact.isDue
                ? "text-xs font-medium text-amber-600 dark:text-amber-400"
                : "text-xs text-zinc-500 dark:text-zinc-400"
            }
          >
            {contact.isDue ? "Due now" : "Not due yet"} — {statusLabel(contact)} (every{" "}
            {contact.cadenceDays}d)
          </p>

          {contact.notes && (
            <p className="text-xs break-words text-zinc-500 dark:text-zinc-400">
              Notes: {contact.notes}
            </p>
          )}
          {contact.giftIdeas && (
            <p className="text-xs break-words text-zinc-500 dark:text-zinc-400">
              Gift ideas: {contact.giftIdeas}
            </p>
          )}

          <button
            type="button"
            onClick={onLogContact}
            disabled={isPending}
            className="self-start rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "Logging…" : "Log Contact"}
          </button>
        </>
      )}
    </div>
  );
}
