"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCleaningTask,
  deleteCleaningTask,
  renameCleaningTask,
  setCleaningTaskCompletion,
  updateCleaningTaskFrequency,
  type AddCleaningTaskState,
} from "@/app/actions/cleaning";
import { getLocalDateString } from "@/lib/date-utils";
import {
  CLEANING_FREQUENCIES,
  CLEANING_FREQUENCY_LABELS,
  computeCleaningStatus,
  type CleaningFrequency,
  type CleaningTaskWithStatus,
} from "@/lib/cleaning-utils";
import { useHasMounted } from "@/lib/use-has-mounted";

const initialAddState: AddCleaningTaskState = null;

// `task.nextDueAt` is the active overdue/due Sunday while isDue, otherwise
// the next upcoming one — see computeCleaningStatus's own doc comment.
function statusLabel(task: CleaningTaskWithStatus, todayLocalDate: string): string {
  if (task.lastCompletedAt === null) return "never done";
  if (!task.nextDueAt) return "";

  const dueLocalDate = getLocalDateString(new Date(task.nextDueAt));
  if (task.isDue) {
    return dueLocalDate < todayLocalDate
      ? `overdue since ${formatNextDue(task.nextDueAt)}`
      : `due ${formatNextDue(task.nextDueAt)}`;
  }
  return `next due ${formatNextDue(task.nextDueAt)}${
    task.daysUntilDue !== null ? ` (in ${task.daysUntilDue}d)` : ""
  }`;
}

// nextDueAt is an absolute instant, so formatting it (unlike the relative
// "Nd ago"/"due in Nd" labels above) is timezone-dependent — only called
// once mounted, same as every other absolute-timestamp display in this app.
function formatNextDue(nextDueAt: string) {
  return new Date(nextDueAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function CleaningCardBody({ tasks }: { tasks: CleaningTaskWithStatus[] }) {
  const router = useRouter();
  const mounted = useHasMounted();

  const [addState, addFormAction, isAdding] = useActionState(addCleaningTask, initialAddState);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  const [localTasks, setLocalTasks] = useState(tasks);
  // Reset local (optimistic) task state whenever fresh data arrives from
  // the server, following React's "adjusting state when a prop changes" pattern.
  const [handledTasks, setHandledTasks] = useState(tasks);
  if (tasks !== handledTasks) {
    setHandledTasks(tasks);
    setLocalTasks(tasks);
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
  const [, startActionTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [recentlyCompletedExpanded, setRecentlyCompletedExpanded] = useState(false);

  // The main list only ever shows tasks not yet done for their current (or
  // upcoming) cycle — see visibleTasks below — so checking one off here
  // always means "mark done now," never an undo/uncheck. Optimistically
  // stamps lastCompletedAt to now and lets computeCleaningStatus (re-run at
  // render time, below) derive isDue/isHidden/nextDueAt fresh from that.
  function handleToggle(task: CleaningTaskWithStatus) {
    setActionError(null);
    const completedAt = new Date().toISOString();
    setLocalTasks((current) =>
      current.map((t) => (t.id === task.id ? { ...t, lastCompletedAt: completedAt } : t)),
    );
    startActionTransition(async () => {
      const result = await setCleaningTaskCompletion(task.id, true);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleDelete(taskId: string) {
    if (!window.confirm("Delete this cleaning task? This also deletes its completion history.")) {
      return;
    }
    setActionError(null);
    setLocalTasks((current) => current.filter((t) => t.id !== taskId));
    startActionTransition(async () => {
      const result = await deleteCleaningTask(taskId);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleFrequencyChange(task: CleaningTaskWithStatus, frequency: CleaningFrequency) {
    setActionError(null);
    setLocalTasks((current) =>
      current.map((t) => (t.id === task.id ? { ...t, frequency } : t)),
    );
    startActionTransition(async () => {
      const result = await updateCleaningTaskFrequency(task.id, frequency);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function startEditing(task: CleaningTaskWithStatus) {
    setEditingId(task.id);
    setEditingName(task.name);
  }

  function saveEditing() {
    if (!editingId) return;
    const taskId = editingId;
    const name = editingName.trim();
    setEditingId(null);
    if (!name) return;

    setLocalTasks((current) => current.map((t) => (t.id === taskId ? { ...t, name } : t)));
    startActionTransition(async () => {
      const result = await renameCleaningTask(taskId, name);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  // Due status is a fixed Sunday-schedule calculation keyed off the local
  // calendar day, so — like Habit Streaks' streak math — it's recomputed
  // fresh here on the client after mount, from each task's raw frequency +
  // lastCompletedAt, rather than trusted from the server's own best-guess
  // local date (see cleaning.ts).
  const today = mounted ? getLocalDateString() : null;
  const displayTasks = today
    ? localTasks.map((t) => computeCleaningStatus(t, t.lastCompletedAt, today))
    : [];

  // Hidden tasks were completed for the current cycle and are waiting for
  // Monday to reappear (shown in Recently Completed below instead). Every
  // other task — whether overdue, due this week, or simply not due yet —
  // stays in the main list, since only that specific post-completion grace
  // window is ever hidden now, not a fixed number of days from due.
  const visibleTasks = displayTasks.filter((task) => !task.isHidden);

  const recentlyCompletedTasks = displayTasks
    .filter((task) => task.isHidden)
    .sort((a, b) => (a.nextDueAt ?? "").localeCompare(b.nextDueAt ?? ""));

  return (
    <div className="flex flex-col gap-3">
      <form
        ref={formRef}
        action={addFormAction}
        onSubmit={() => {
          submittedRef.current = true;
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          name="name"
          placeholder="Add a cleaning task"
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
        />
        <select
          name="frequency"
          defaultValue="weekly"
          className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-600 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
        >
          {CLEANING_FREQUENCIES.map((frequency) => (
            <option key={frequency} value={frequency}>
              {CLEANING_FREQUENCY_LABELS[frequency]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isAdding}
          className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isAdding ? "Adding…" : "Add"}
        </button>
      </form>

      {addState?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{addState.error}</p>
      )}
      {actionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}

      {!mounted ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading…</p>
      ) : localTasks.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No cleaning tasks yet — add one above.
        </p>
      ) : visibleTasks.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          All cleaning tasks are done for the week — they&apos;ll reappear Monday.
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {visibleTasks.map((task) => (
            <li
              key={task.id}
              data-testid={`cleaning-task-${task.id}`}
              className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => handleToggle(task)}
                  className="h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
                />

                {editingId === task.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={saveEditing}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditing();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(task)}
                    className="min-w-0 flex-1 truncate text-left text-sm text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    {task.name}
                  </button>
                )}

                <select
                  value={task.frequency}
                  onChange={(e) =>
                    handleFrequencyChange(task, e.target.value as CleaningFrequency)
                  }
                  className="shrink-0 rounded-lg border border-zinc-200 bg-white px-1.5 py-0.5 text-xs text-zinc-600 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {CLEANING_FREQUENCIES.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {CLEANING_FREQUENCY_LABELS[frequency]}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  aria-label="Delete cleaning task"
                  className="shrink-0 text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                >
                  ✕
                </button>
              </div>

              <p
                className={
                  task.isDue
                    ? "mt-1 text-xs font-medium text-amber-600 dark:text-amber-400"
                    : "mt-1 text-xs text-zinc-500 dark:text-zinc-400"
                }
              >
                {task.isDue ? "Due now" : "Not due yet"} — {statusLabel(task, today!)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setRecentlyCompletedExpanded((expanded) => !expanded)}
          aria-expanded={recentlyCompletedExpanded}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          <span>{recentlyCompletedExpanded ? "▾" : "▸"}</span>
          Recently completed
          {recentlyCompletedTasks.length > 0 && ` (${recentlyCompletedTasks.length})`}
        </button>

        {recentlyCompletedExpanded && (
          <div className="mt-3 flex max-h-60 flex-col gap-2 overflow-y-auto">
            {recentlyCompletedTasks.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Nothing recently completed.
              </p>
            ) : (
              recentlyCompletedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
                >
                  <span className="min-w-0 truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {task.name}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {mounted && task.nextDueAt ? `Next due ${formatNextDue(task.nextDueAt)}` : "…"}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
