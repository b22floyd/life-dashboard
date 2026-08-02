"use client";

import { useActionState, useEffect, useRef } from "react";
import { addJournalEntry, type JournalFormState } from "@/app/actions/journal";
import { transcribeAudio, type TranscribeState } from "@/app/actions/transcribe";
import type { JournalEntry } from "@/lib/journal";
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

export function JournalCard({ entries }: { entries: JournalEntry[] }) {
  const [state, formAction, pending] = useActionState(
    addJournalEntry,
    initialFormState,
  );
  const [transcribeState, transcribeFormAction, transcribing] =
    useActionState(transcribeAudio, initialTranscribeState);

  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioFormRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

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
    <WidgetCard title="Journal" className="lg:col-span-2">
      <form
        ref={audioFormRef}
        action={transcribeFormAction}
        className="mb-3 flex flex-col gap-3 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <input
          type="file"
          name="audio"
          // Plain "audio/*" grays out .m4a in iOS's file picker (Voice
          // Memos' default export format), so list extensions explicitly.
          accept="audio/*,.m4a,.mp3,.mp4,.wav,.aac,.webm,.ogg,.flac"
          required
          className="min-w-0 text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200 sm:flex-1"
        />
        <button
          type="submit"
          disabled={transcribing}
          className="w-full shrink-0 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:w-auto"
        >
          {transcribing ? "Transcribing…" : "Upload & Transcribe"}
        </button>
        {transcribeState && "error" in transcribeState && (
          <p className="w-full text-sm text-red-600 dark:text-red-400">
            {transcribeState.error}
          </p>
        )}
      </form>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => {
          submittedRef.current = true;
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          ref={textareaRef}
          name="content"
          rows={4}
          required
          placeholder="What happened today? Write here or upload a voice memo above."
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
