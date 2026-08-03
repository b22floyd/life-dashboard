"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addWeightEntry,
  deleteWeightEntry,
  updateWeightGoal,
  type AddWeightEntryState,
} from "@/app/actions/weight";
import { getLocalDateString } from "@/lib/date-utils";
import { useHasMounted } from "@/lib/use-has-mounted";
import {
  computeWeekOverWeekChange,
  estimateWeeksToGoal,
  type WeightEntry,
  type WeightGoal,
} from "@/lib/weight-utils";
import { WeightTrendChart } from "./WeightTrendChart";

const initialAddState: AddWeightEntryState = null;

function formatEntryDate(entryDate: string) {
  return new Date(`${entryDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function WeightTrackerSection({
  entries,
  goal,
}: {
  entries: WeightEntry[];
  goal: WeightGoal;
}) {
  const mounted = useHasMounted();
  const router = useRouter();

  // Goal form
  const [goalWeightInput, setGoalWeightInput] = useState(goal ? String(goal.goalWeight) : "");
  const [targetDateInput, setTargetDateInput] = useState(goal?.targetDate ?? "");
  const [goalError, setGoalError] = useState<string | null>(null);
  const [isSavingGoal, startGoalTransition] = useTransition();

  // Reset the goal form's fields whenever fresh data arrives from the
  // server, following React's "adjusting state when a prop changes" pattern.
  const [handledGoal, setHandledGoal] = useState(goal);
  if (goal !== handledGoal) {
    setHandledGoal(goal);
    setGoalWeightInput(goal ? String(goal.goalWeight) : "");
    setTargetDateInput(goal?.targetDate ?? "");
  }

  function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    const weight = Number(goalWeightInput);
    if (!goalWeightInput || Number.isNaN(weight) || weight <= 0) {
      setGoalError("Enter a valid goal weight.");
      return;
    }
    setGoalError(null);
    startGoalTransition(async () => {
      const result = await updateWeightGoal(weight, targetDateInput || null);
      if ("error" in result) setGoalError(result.error);
      router.refresh();
    });
  }

  // Log-weight form. The date field is uncontrolled (like JournalCard's
  // entry-date field) — its default is set imperatively via a ref rather
  // than React state, since a server-rendered default can't be "today" (see
  // Timezones) and resetting *state* inside the effect below would trip the
  // "no setState in an effect" rule; a plain DOM mutation on a ref doesn't.
  const [addState, addFormAction, isAdding] = useActionState(addWeightEntry, initialAddState);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const logDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (logDateRef.current && !logDateRef.current.value) {
      logDateRef.current.value = getLocalDateString();
    }
  }, []);

  useEffect(() => {
    if (submittedRef.current && !isAdding) {
      submittedRef.current = false;
      if (!addState?.error) {
        formRef.current?.reset();
        if (logDateRef.current) {
          logDateRef.current.value = getLocalDateString();
        }
      }
    }
  }, [addState, isAdding]);

  // History + delete
  const [localEntries, setLocalEntries] = useState(entries);
  const [handledEntries, setHandledEntries] = useState(entries);
  if (entries !== handledEntries) {
    setHandledEntries(entries);
    setLocalEntries(entries);
  }
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  function handleDelete(entryId: string) {
    setDeleteError(null);
    setLocalEntries((current) => current.filter((entry) => entry.id !== entryId));
    startDeleteTransition(async () => {
      const result = await deleteWeightEntry(entryId);
      if ("error" in result) setDeleteError(result.error);
      router.refresh();
    });
  }

  // Week-over-week change and the weeks-to-goal estimate both depend on the
  // browser's local "today" — wait for mount rather than risk computing
  // them against the server's (often UTC) clock.
  const today = mounted ? getLocalDateString() : null;
  const weekChange = today ? computeWeekOverWeekChange(localEntries, today) : null;
  const estimate = today && goal ? estimateWeeksToGoal(localEntries, goal.goalWeight, today) : null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Weight Tracker</h3>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form
          onSubmit={handleSaveGoal}
          className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
        >
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Goal</p>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={goalWeightInput}
            onChange={(e) => setGoalWeightInput(e.target.value)}
            placeholder="Goal weight (lb)"
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          />
          <input
            type="date"
            value={targetDateInput}
            onChange={(e) => setTargetDateInput(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          />
          {goalError && <p className="text-xs text-red-600 dark:text-red-400">{goalError}</p>}
          <button
            type="submit"
            disabled={isSavingGoal}
            className="self-end rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isSavingGoal ? "Saving…" : "Save Goal"}
          </button>
        </form>

        <form
          ref={formRef}
          action={addFormAction}
          onSubmit={() => {
            submittedRef.current = true;
          }}
          className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
        >
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Log Weight</p>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            name="weight"
            placeholder="Weight (lb)"
            required
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          />
          <input
            ref={logDateRef}
            type="date"
            name="entryDate"
            required
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          />
          {addState?.error && (
            <p className="text-xs text-red-600 dark:text-red-400">{addState.error}</p>
          )}
          <button
            type="submit"
            disabled={isAdding || !mounted}
            className="self-end rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isAdding ? "Logging…" : "Log Weight"}
          </button>
        </form>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            This week vs last week
          </p>
          {!mounted ? (
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">…</p>
          ) : weekChange === null ? (
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Not enough data yet</p>
          ) : (
            <p
              className={
                weekChange.change > 0
                  ? "mt-1 flex items-center gap-1 text-lg font-bold text-red-600 dark:text-red-400"
                  : weekChange.change < 0
                    ? "mt-1 flex items-center gap-1 text-lg font-bold text-green-600 dark:text-green-400"
                    : "mt-1 flex items-center gap-1 text-lg font-bold text-zinc-600 dark:text-zinc-300"
              }
            >
              <span aria-hidden>
                {weekChange.change > 0 ? "▲" : weekChange.change < 0 ? "▼" : "—"}
              </span>
              {Math.abs(weekChange.change).toFixed(1)} lb
            </p>
          )}
        </div>

        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Estimated time to goal
          </p>
          {!goal ? (
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Set a goal weight above</p>
          ) : !mounted || estimate === null ? (
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">…</p>
          ) : estimate.status === "insufficient_data" ? (
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
              Log a few more weeks to see an estimate
            </p>
          ) : estimate.status === "already_at_goal" ? (
            <p className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">
              Goal reached!
            </p>
          ) : estimate.status === "no_progress" ? (
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
              Not currently trending toward your goal
            </p>
          ) : (
            <p className="mt-1 text-lg font-bold text-zinc-800 dark:text-zinc-200">
              ~{estimate.weeksLeft} week{estimate.weeksLeft === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <WeightTrendChart entries={localEntries} goalWeight={goal?.goalWeight ?? null} />
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setHistoryExpanded((expanded) => !expanded)}
          aria-expanded={historyExpanded}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          <span>{historyExpanded ? "▾" : "▸"}</span>
          History{localEntries.length > 0 && ` (${localEntries.length})`}
        </button>

        {deleteError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
        )}

        {historyExpanded && (
          <div className="mt-3 flex max-h-60 flex-col gap-2 overflow-y-auto">
            {localEntries.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">No weight logged yet.</p>
            ) : (
              [...localEntries].reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
                >
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {formatEntryDate(entry.entryDate)}
                  </span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {entry.weight} lb
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    aria-label="Delete weight entry"
                    className="shrink-0 text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
