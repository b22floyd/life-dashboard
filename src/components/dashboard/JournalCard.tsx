"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addJournalEntry, deleteJournalEntry, type JournalFormState } from "@/app/actions/journal";
import { transcribeAudio, type TranscribeState } from "@/app/actions/transcribe";
import { getLocalDateString } from "@/lib/date-utils";
import type { JournalEntry } from "@/lib/journal";
import { SectionLoadError } from "./SectionLoadError";
import { WidgetCard } from "./WidgetCard";

const initialFormState: JournalFormState = null;
const initialTranscribeState: TranscribeState = null;

function formatEntryDate(entryDate: string) {
  return new Date(`${entryDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function JournalCard({ entries }: { entries: JournalEntry[] | null }) {
  const router = useRouter();
  // Null means the entry history failed to load — writing a new entry
  // doesn't depend on that history, so the compose form below still works;
  // only the entry list itself shows a load error instead of falling
  // through to a misleading "No entries yet."
  const loadFailed = entries === null;
  const safeEntries = entries ?? [];
  const [state, formAction, pending] = useActionState(
    addJournalEntry,
    initialFormState,
  );
  const [transcribeState, transcribeFormAction, transcribing] =
    useActionState(transcribeAudio, initialTranscribeState);

  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioFormRef = useRef<HTMLFormElement>(null);
  const entryDateRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  const [entriesExpanded, setEntriesExpanded] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  const [localEntries, setLocalEntries] = useState(safeEntries);
  // Reset local (optimistic) entry state whenever fresh data arrives from
  // the server, following React's "adjusting state when a prop changes" pattern.
  const [handledEntries, setHandledEntries] = useState(entries);
  if (entries !== handledEntries) {
    setHandledEntries(entries);
    setLocalEntries(safeEntries);
  }

  function handleDeleteEntry(entryId: string) {
    if (!window.confirm("Are you sure you want to delete this entry?")) {
      return;
    }
    setDeleteError(null);
    setLocalEntries((current) => current.filter((entry) => entry.id !== entryId));
    startDeleteTransition(async () => {
      const result = await deleteJournalEntry(entryId);
      if ("error" in result) {
        setDeleteError(result.error);
      }
      router.refresh();
    });
  }

  useEffect(() => {
    if (submittedRef.current && !pending) {
      submittedRef.current = false;
      if (!state?.error) {
        formRef.current?.reset();
      }
    }
  }, [state, pending]);

  useEffect(() => {
    if (!transcribeState) return;

    if ("text" in transcribeState && textareaRef.current) {
      const existing = textareaRef.current.value.trim();
      textareaRef.current.value = existing
        ? `${existing}\n\n${transcribeState.text}`
        : transcribeState.text;
      textareaRef.current.focus();
    }

    audioFormRef.current?.reset();
  }, [transcribeState]);

  return (
    <WidgetCard title="Journal" className="lg:col-span-2" id="journal-section">
      <form
        id="journal-entry-form"
        ref={formRef}
        action={formAction}
        onSubmit={() => {
          submittedRef.current = true;
          // Set right at submit time — computing this at render time would
          // bake in whatever the server rendered initially, and the actual
          // insert needs the browser's local date, not the server's.
          if (entryDateRef.current) {
            entryDateRef.current.value = getLocalDateString();
          }
        }}
        className="flex flex-col gap-3"
      >
        <input ref={entryDateRef} type="hidden" name="entryDate" />
        <textarea
          ref={textareaRef}
          name="content"
          rows={4}
          required
          placeholder="What happened today? Write here or upload a voice memo below."
          className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
        />
        {state?.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </form>

      {/* A sibling of the entry form (forms can't nest) — its Upload &
          Transcribe button sits on the same line as Save Entry via that
          button's `form` attribute, which ties it back to the entry form
          above without needing to live inside its DOM subtree. */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <form
          ref={audioFormRef}
          action={transcribeFormAction}
          className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-1 sm:flex-nowrap"
        >
          <input
            type="file"
            name="audio"
            // Plain "audio/*" grays out .m4a in iOS's file picker (Voice
            // Memos' default export format), so list extensions explicitly.
            accept="audio/*,.m4a,.mp3,.mp4,.wav,.aac,.webm,.ogg,.flac"
            required
            className="shrink-0 text-xs text-zinc-600 file:mr-2 file:rounded-full file:border-0 file:bg-zinc-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-zinc-700 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200 sm:min-w-0 sm:flex-1"
          />
          <button
            type="submit"
            disabled={transcribing}
            className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {transcribing ? "Transcribing…" : "Upload & Transcribe"}
          </button>
        </form>
        <button
          type="submit"
          form="journal-entry-form"
          disabled={pending}
          className="shrink-0 self-end rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 sm:self-auto"
        >
          {pending ? "Saving…" : "Save Entry"}
        </button>
      </div>
      {transcribeState && "error" in transcribeState && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{transcribeState.error}</p>
      )}

      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setEntriesExpanded((expanded) => !expanded)}
          aria-expanded={entriesExpanded}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          <span>{entriesExpanded ? "▾" : "▸"}</span>
          Entries{localEntries.length > 0 && ` (${localEntries.length})`}
        </button>

        {deleteError && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
        )}

        {entriesExpanded && (
          <div className="mt-3 flex max-h-80 flex-col gap-3 overflow-y-auto">
            {loadFailed ? (
              <SectionLoadError message="Couldn't load your journal entries right now." />
            ) : localEntries.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                No entries yet — write your first one above.
              </p>
            ) : null}
            {localEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {formatEntryDate(entry.entry_date)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="shrink-0 text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                    aria-label="Delete entry"
                  >
                    Delete
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {entry.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
