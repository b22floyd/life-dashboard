"use client";

import { useActionState, useEffect, useRef } from "react";
import { addJournalEntry, type JournalFormState } from "@/app/actions/journal";
import type { JournalEntry } from "@/lib/journal";
import { WidgetCard } from "./WidgetCard";

const initialState: JournalFormState = null;

function formatEntryDate(entryDate: string) {
  return new Date(`${entryDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function JournalCard({ entries }: { entries: JournalEntry[] }) {
  const [state, formAction, pending] = useActionState(
    addJournalEntry,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !pending) {
      submittedRef.current = false;
      if (!state?.error) {
        formRef.current?.reset();
      }
    }
  }, [state, pending]);

  return (
    <WidgetCard title="Journal" className="lg:col-span-2">
      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => {
          submittedRef.current = true;
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          name="content"
          rows={4}
          required
          placeholder="What happened today?"
          className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
        />
        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="self-end rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving…" : "Save Entry"}
        </button>
      </form>

      <div className="mt-5 flex max-h-80 flex-col gap-3 overflow-y-auto border-t border-zinc-200 pt-4 dark:border-zinc-800">
        {entries.length === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No entries yet — write your first one above.
          </p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
          >
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {formatEntryDate(entry.entry_date)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {entry.content}
            </p>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
