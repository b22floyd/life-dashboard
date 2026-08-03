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
import {
  CLEANING_FREQUENCIES,
  CLEANING_FREQUENCY_LABELS,
  computeCleaningStatus,
  type CleaningFrequency,
  type CleaningTaskWithStatus,
} from "@/lib/cleaning-utils";

const initialAddState: AddCleaningTaskState = null;

function statusLabel(task: CleaningTaskWithStatus): string {
  if (task.lastCompletedAt === null) return "never done";
  if (task.isDue) return `done ${task.daysSinceCompleted}d ago`;
  return `done ${task.daysSinceCompleted}d ago, due in ${task.daysUntilDue}d`;
}

export function CleaningCardBody({ tasks }: { tasks: CleaningTaskWithStatus[] }) {
  const router = useRouter();

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

  function handleToggle(task: CleaningTaskWithStatus) {
    setActionError(null);
    const willComplete = task.isDue;
    // Optimistic approximation: recompute status as if the task had just
    // been marked done (or as if it had never been done, when unchecking) —
    // the exact prior completion history isn't tracked client-side, and
    // router.refresh() below reconciles with the real state either way.
    const optimisticStatus = computeCleaningStatus(
      task,
      willComplete ? new Date().toISOString() : null,
    );
    setLocalTasks((current) =>
      current.map((t) => (t.id === task.id ? optimisticStatus : t)),
    );
    startActionTransition(async () => {
      const result = await setCleaningTaskCompletion(task.id, willComplete);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleDelete(taskId: string) {
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
    const nextTask = { ...task, frequency };
    setLocalTasks((current) =>
      current.map((t) =>
        t.id === task.id ? computeCleaningStatus(nextTask, t.lastCompletedAt) : t,
      ),
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
        <p className="text-sm text-red-600 dark:text-red-400">{addState.error}</p>
      )}
      {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}

      {localTasks.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No cleaning tasks yet — add one above.
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {localTasks.map((task) => (
            <li
              key={task.id}
              data-testid={`cleaning-task-${task.id}`}
              className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!task.isDue}
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
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm text-zinc-800 outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
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
                {task.isDue ? "Due now" : "Not due yet"} — {statusLabel(task)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
