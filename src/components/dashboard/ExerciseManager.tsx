"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergeExercises } from "@/app/actions/workout";
import {
  getExerciseUsage,
  suggestExerciseMergeGroups,
  type WorkoutSession,
} from "@/lib/workout-utils";

const inputClass =
  "min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200";

function describeUsage(sessionCount: number, setCount: number) {
  const sessions = `${sessionCount} session${sessionCount === 1 ? "" : "s"}`;
  const sets = `${setCount} set${setCount === 1 ? "" : "s"}`;
  return `${sessions} · ${sets}`;
}

// Merging is a rename, not a delete: every set stays attached to the session
// it was logged in, and the progress chart simply starts reporting them all
// under one name. Nothing is merged automatically — the suggestions below are
// only a starting point the user confirms.
export function ExerciseManager({ sessions }: { sessions: WorkoutSession[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [targetName, setTargetName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isMerging, startMergeTransition] = useTransition();

  const usage = useMemo(() => getExerciseUsage(sessions), [sessions]);
  const suggestions = useMemo(() => suggestExerciseMergeGroups(usage), [usage]);

  function toggleSelected(name: string) {
    setError(null);
    setResult(null);
    setSelected((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
  }

  function runMerge(names: string[], canonical: string) {
    setError(null);
    setResult(null);

    const trimmed = canonical.trim();
    if (!trimmed) {
      setError("Enter a name to merge into.");
      return;
    }

    startMergeTransition(async () => {
      const response = await mergeExercises(names, trimmed);
      if ("error" in response) {
        setError(response.error);
        return;
      }
      setResult(
        `Merged into "${trimmed}" — ${response.updatedCount} entr${
          response.updatedCount === 1 ? "y" : "ies"
        } updated.`,
      );
      setSelected([]);
      setTargetName("");
      router.refresh();
    });
  }

  // Default the merge target to whichever selected spelling has the most
  // history behind it, so the common case needs no typing at all.
  const defaultTarget =
    selected
      .map((name) => usage.find((entry) => entry.name === name))
      .filter((entry) => entry !== undefined)
      .sort((a, b) => b.setCount - a.setCount || a.name.localeCompare(b.name))[0]?.name ?? "";

  return (
    <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        <span aria-hidden>{expanded ? "▾" : "▸"}</span>
        Manage Exercises{usage.length > 0 && ` (${usage.length})`}
        {suggestions.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {suggestions.length} possible duplicate{suggestions.length === 1 ? "" : "s"}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-4">
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {result && <p className="text-sm text-emerald-600 dark:text-emerald-400">{result}</p>}

          {usage.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              No exercises logged yet.
            </p>
          ) : (
            <>
              {suggestions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Possible duplicates
                  </p>
                  {suggestions.map((suggestion) => (
                    <SuggestionRow
                      key={suggestion.canonical}
                      names={suggestion.names}
                      canonical={suggestion.canonical}
                      disabled={isMerging}
                      onMerge={runMerge}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  All exercises
                </p>
                <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                  {usage.map((entry) => (
                    <li key={entry.name}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(entry.name)}
                          onChange={() => toggleSelected(entry.name)}
                          className="h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                          {entry.name}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                          {describeUsage(entry.sessionCount, entry.setCount)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                {selected.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Merge {selected.length} into
                    </span>
                    <input
                      type="text"
                      value={targetName || defaultTarget}
                      onChange={(e) => setTargetName(e.target.value)}
                      aria-label="Merge into name"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      disabled={isMerging}
                      onClick={() => runMerge(selected, targetName || defaultTarget)}
                      className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      {isMerging ? "Merging…" : "Merge"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Select two or more to merge them into a single exercise.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({
  names,
  canonical,
  disabled,
  onMerge,
}: {
  names: string[];
  canonical: string;
  disabled: boolean;
  onMerge: (names: string[], canonical: string) => void;
}) {
  const [target, setTarget] = useState(canonical);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-900/50 dark:bg-amber-900/20">
      <span className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
        {names.map((name) => `"${name}"`).join(" · ")}
      </span>
      <input
        type="text"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Merge into name"
        className={inputClass}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onMerge(names, target)}
        className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Merge
      </button>
    </div>
  );
}
