"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPersonalTask,
  completePersonalTask,
  updatePersonalTaskDueDate,
  type AddTaskState,
} from "@/app/actions/personal-tasks";
import { getLocalDateString } from "@/lib/date-utils";
import { useHasMounted } from "@/lib/use-has-mounted";
import type { PersonalTask } from "@/lib/personal-tasks";
import { SectionLoadError } from "./SectionLoadError";

const initialAddState: AddTaskState = null;

// Local ("yyyy-mm-dd") date arithmetic, entirely independent of any
// particular timezone offset — mirrors the same private helper in
// cleaning-utils.ts/habit-utils.ts/weight-utils.ts. Takes a known date
// string rather than reading Date.now() directly, which the render-purity
// lint rule doesn't allow calling straight from a component body.
function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Personal task due dates are always plain "yyyy-mm-dd" strings (no time
// component, unlike Todoist's), so — unlike Work Tasks' Date-based
// helpers — these compare directly as strings, which sorts/compares
// chronologically exactly the same way for this format.
function formatDueDate(dueDate: string) {
  const date = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TABS = ["today", "tomorrow", "upcoming"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = { today: "Today", tomorrow: "Tomorrow", upcoming: "Upcoming" };

const dateInputClass =
  "rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200";

export function PersonalTasksCardBody({ tasks }: { tasks: PersonalTask[] | null }) {
  // Bucketing by today/tomorrow depends on the device's local calendar day,
  // which a Server Component can't know — wait until mount rather than risk
  // grouping tasks using the server's (often UTC) clock on first render.
  const mounted = useHasMounted();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("today");

  const [addState, addFormAction, isAdding] = useActionState(addPersonalTask, initialAddState);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  // Null means the fetch failed; adding a task doesn't depend on the list
  // having loaded, so the form below still works either way.
  const loadFailed = tasks === null;
  const safeTasks = tasks ?? [];

  const [localTasks, setLocalTasks] = useState(safeTasks);
  // Reset local (optimistic) task state whenever fresh data arrives from the
  // server, following React's "adjusting state when a prop changes" pattern.
  const [handledTasks, setHandledTasks] = useState(tasks);
  if (tasks !== handledTasks) {
    setHandledTasks(tasks);
    setLocalTasks(safeTasks);
  }

  useEffect(() => {
    if (submittedRef.current && !isAdding) {
      submittedRef.current = false;
      if (!addState?.error) {
        formRef.current?.reset();
      }
    }
  }, [addState, isAdding]);

  const [taskError, setTaskError] = useState<string | null>(null);
  const [, startCompleteTransition] = useTransition();
  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
  const [dueDateError, setDueDateError] = useState<string | null>(null);
  const [, startDueDateTransition] = useTransition();

  function handleComplete(taskId: string) {
    setTaskError(null);
    setLocalTasks((current) => current.filter((task) => task.id !== taskId));
    startCompleteTransition(async () => {
      const result = await completePersonalTask(taskId);
      if ("error" in result) {
        setTaskError(result.error);
      }
      router.refresh();
    });
  }

  function handleSetDueDate(taskId: string, dueDate: string | null) {
    setDueDateError(null);
    setEditingDueDateId(null);
    setLocalTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, due_date: dueDate } : task)),
    );
    startDueDateTransition(async () => {
      const result = await updatePersonalTaskDueDate(taskId, dueDate);
      if ("error" in result) {
        setDueDateError(result.error);
      }
      router.refresh();
    });
  }

  const sortedTasks = useMemo(
    () =>
      [...localTasks].sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      }),
    [localTasks],
  );

  const today = mounted ? getLocalDateString() : null;
  const tomorrow = today ? addDays(today, 1) : null;

  const todayTasks = useMemo(
    () => (today ? sortedTasks.filter((task) => task.due_date && task.due_date <= today) : []),
    [sortedTasks, today],
  );
  const tomorrowTasks = useMemo(
    () => (tomorrow ? sortedTasks.filter((task) => task.due_date === tomorrow) : []),
    [sortedTasks, tomorrow],
  );
  const upcomingTasks = useMemo(
    () =>
      today && tomorrow
        ? sortedTasks.filter((task) => !task.due_date || (task.due_date > today && task.due_date !== tomorrow))
        : [],
    [sortedTasks, today, tomorrow],
  );
  const visibleTasks =
    tab === "today" ? todayTasks : tab === "tomorrow" ? tomorrowTasks : upcomingTasks;

  return (
    <div className="flex flex-col gap-3">
      <form
        ref={formRef}
        action={addFormAction}
        onSubmit={() => {
          submittedRef.current = true;
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          type="text"
          name="content"
          placeholder="Add a task"
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
        />
        <input type="date" name="dueDate" aria-label="Due date (optional)" className={dateInputClass} />
        <button
          type="submit"
          disabled={isAdding}
          className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isAdding ? "Adding…" : "Add"}
        </button>
      </form>

      {addState?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{addState.error}</p>
      )}
      {taskError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{taskError}</p>}
      {dueDateError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{dueDateError}</p>}

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "border-b-2 border-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-b-2 border-transparent px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            }
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {loadFailed ? (
        <SectionLoadError message="Couldn't load your personal tasks right now." />
      ) : !mounted ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading…</p>
      ) : visibleTasks.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          {tab === "today"
            ? "Nothing due today."
            : tab === "tomorrow"
              ? "Nothing due tomorrow."
              : "No upcoming tasks."}
        </p>
      ) : (
        <ul className="flex max-h-60 flex-col gap-3 overflow-y-auto">
          {visibleTasks.map((task) => (
            <li key={task.id} className="flex items-start gap-3">
              <input
                type="checkbox"
                onChange={() => handleComplete(task.id)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm break-words text-zinc-700 dark:text-zinc-300">{task.content}</p>
                {editingDueDateId === task.id ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={task.due_date ?? ""}
                    aria-label="Due date"
                    className={`mt-1 ${dateInputClass}`}
                    onBlur={(e) => handleSetDueDate(task.id, e.target.value || null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditingDueDateId(null);
                    }}
                  />
                ) : task.due_date ? (
                  <button
                    type="button"
                    onClick={() => setEditingDueDateId(task.id)}
                    className={
                      today && task.due_date < today
                        ? "text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
                        : "text-xs text-zinc-400 hover:underline dark:text-zinc-500"
                    }
                  >
                    {formatDueDate(task.due_date)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDueDateId(task.id)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    + Add date
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
