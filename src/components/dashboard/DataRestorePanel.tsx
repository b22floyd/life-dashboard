"use client";

import { useState, useTransition } from "react";
import { restoreDataSection } from "@/app/actions/restore";
import {
  parseBackupFile,
  RESTORABLE_SECTIONS,
  SECTION_CAVEATS,
  SECTION_LABELS,
  SECTION_SCHEMAS,
  summarizeSection,
  type ParsedBackupFile,
  type RestorableSection,
} from "@/lib/restore-utils";

type SectionStatus = "idle" | "confirming" | "restoring" | "done" | "error";

function formatExportedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DataRestorePanel() {
  const [fileError, setFileError] = useState<string | null>(null);
  const [backup, setBackup] = useState<ParsedBackupFile | null>(null);
  const [statuses, setStatuses] = useState<Partial<Record<RestorableSection, SectionStatus>>>({});
  const [messages, setMessages] = useState<Partial<Record<RestorableSection, string>>>({});
  const [, startTransition] = useTransition();

  function handleFile(file: File) {
    setFileError(null);
    setBackup(null);
    setStatuses({});
    setMessages({});

    const reader = new FileReader();
    reader.onload = () => {
      let json: unknown;
      try {
        json = JSON.parse(String(reader.result));
      } catch {
        setFileError("That file isn't valid JSON.");
        return;
      }
      const result = parseBackupFile(json);
      if ("error" in result) {
        setFileError(result.error);
        return;
      }
      setBackup(result.data);
    };
    reader.onerror = () => setFileError("Couldn't read that file.");
    reader.readAsText(file);
  }

  function askConfirm(section: RestorableSection) {
    setStatuses((current) => ({ ...current, [section]: "confirming" }));
  }

  function cancelConfirm(section: RestorableSection) {
    setStatuses((current) => ({ ...current, [section]: "idle" }));
  }

  function runRestore(section: RestorableSection) {
    if (!backup) return;
    setStatuses((current) => ({ ...current, [section]: "restoring" }));
    startTransition(async () => {
      const sectionData = backup.raw[section];
      const result = await restoreDataSection(section, sectionData);
      if ("error" in result) {
        setStatuses((current) => ({ ...current, [section]: "error" }));
        setMessages((current) => ({ ...current, [section]: result.error }));
      } else {
        setStatuses((current) => ({ ...current, [section]: "done" }));
        setMessages((current) => ({ ...current, [section]: result.message }));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Choose a backup file
        </label>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:text-zinc-400 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:hover:file:bg-zinc-300"
        />
        {fileError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {fileError}
          </p>
        )}
      </div>

      {backup && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Backup from <span className="font-medium">{formatExportedAt(backup.exportedAt)}</span>.
            Pick a section to restore — each one replaces that section&apos;s current data.
          </p>

          <ul className="flex flex-col gap-2">
            {RESTORABLE_SECTIONS.map((section) => {
              const status = statuses[section] ?? "idle";
              const sectionData = backup.raw[section];
              const parsesCleanly = SECTION_SCHEMAS[section].safeParse(sectionData).success;
              const summary = summarizeSection(section, sectionData);
              const caveat = SECTION_CAVEATS[section];

              return (
                <li
                  key={section}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {SECTION_LABELS[section]}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{summary}</p>
                    </div>

                    <div role="status" className="shrink-0">
                      {status === "idle" && (
                        <button
                          type="button"
                          disabled={!parsesCleanly}
                          onClick={() => askConfirm(section)}
                          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Restore
                        </button>
                      )}
                      {status === "restoring" && (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">Restoring…</span>
                      )}
                      {status === "done" && (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Restored
                        </span>
                      )}
                    </div>
                  </div>

                  {status === "confirming" && (
                    <div role="alert" className="mt-2 rounded-lg bg-amber-50 p-2 dark:bg-amber-900/20">
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">
                        {`This replaces your current ${SECTION_LABELS[section]} data with what's in the backup. This can't be undone unless you have another backup to restore from.`}
                      </p>
                      {caveat && (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{caveat}</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => runRestore(section)}
                          className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                        >
                          Yes, replace my {SECTION_LABELS[section]} data
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelConfirm(section)}
                          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {status === "error" && (
                    <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
                      {messages[section]}
                    </p>
                  )}
                  {status === "done" && messages[section] && caveat && (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{caveat}</p>
                  )}
                  {!parsesCleanly && status === "idle" && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      This section&apos;s data doesn&apos;t match the expected shape — can&apos;t
                      restore it.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
