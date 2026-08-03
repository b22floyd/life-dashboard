"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeTodoistTask, saveTodoistProjectSelection } from "@/app/actions/todoist";
import type { TodoistProject, TodoistTask } from "@/lib/todoist";

function parseDueDate(dueDate: string): Date {
  // Date-only strings ("2026-08-10") parse as UTC midnight, which can shift
  // to the previous day in negative-offset timezones — force local midnight.
  return new Date(dueDate.includes("T") ? dueDate : `${dueDate}T00:00:00`);
}

function formatDueDate(dueDate: string) {
  const hasTime = dueDate.includes("T");
  const date = parseDueDate(dueDate);
  if (Number.isNaN(date.getTime())) return dueDate;
  return date.toLocaleDateString(
    "en-US",
    hasTime
      ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" },
  );
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isDueTodayOrOverdue(dueDate: string): boolean {
  const due = parseDueDate(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return dateKey(due) <= dateKey(new Date());
}

function isDueTomorrow(dueDate: string): boolean {
  const due = parseDueDate(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateKey(due) === dateKey(tomorrow);
}

const TABS = ["today", "tomorrow", "upcoming"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = { today: "Today", tomorrow: "Tomorrow", upcoming: "Upcoming" };

export function TasksCardBody({
  projects,
  selectedProjectIds,
  tasks,
}: {
  projects: TodoistProject[] | null;
  selectedProjectIds: string[];
  tasks: TodoistTask[] | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("today");
  const [editing, setEditing] = useState(selectedProjectIds.length === 0);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(selectedProjectIds));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingSelection, startSaveTransition] = useTransition();
  const [taskError, setTaskError] = useState<string | null>(null);
  const [, startCompleteTransition] = useTransition();

  const [localTasks, setLocalTasks] = useState(tasks ?? []);
  // Reset local (optimistic) task state whenever fresh data arrives from the
  // server, following React's "adjusting state when a prop changes" pattern.
  const [handledTasks, setHandledTasks] = useState(tasks);
  if (tasks !== handledTasks) {
    setHandledTasks(tasks);
    setLocalTasks(tasks ?? []);
  }

  const sortedTasks = useMemo(
    () =>
      [...localTasks].sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      }),
    [localTasks],
  );

  const todayTasks = useMemo(
    () => sortedTasks.filter((task) => task.dueDate && isDueTodayOrOverdue(task.dueDate)),
    [sortedTasks],
  );
  const tomorrowTasks = useMemo(
    () => sortedTasks.filter((task) => task.dueDate && isDueTomorrow(task.dueDate)),
    [sortedTasks],
  );
  const upcomingTasks = useMemo(
    () =>
      sortedTasks.filter(
        (task) => !task.dueDate || (!isDueTodayOrOverdue(task.dueDate) && !isDueTomorrow(task.dueDate)),
      ),
    [sortedTasks],
  );
  const visibleTasks =
    tab === "today" ? todayTasks : tab === "tomorrow" ? tomorrowTasks : upcomingTasks;

  function toggleChecked(id: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSaveSelection() {
    setSaveError(null);
    startSaveTransition(async () => {
      const result = await saveTodoistProjectSelection(Array.from(checkedIds));
      if ("error" in result) {
        setSaveError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleToggleComplete(taskId: string) {
    setTaskError(null);
    setLocalTasks((current) => current.filter((task) => task.id !== taskId));
    startCompleteTransition(async () => {
      const result = await completeTodoistTask(taskId);
      if ("error" in result) {
        setTaskError(result.error);
      }
      router.refresh();
    });
  }

  if (projects === null) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load Todoist projects. Check that TODOIST_API_TOKEN is set correctly.
      </p>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Choose which Todoist project(s) to show here.
        </p>
        {projects.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">No Todoist projects found.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`todoist-project-${project.id}`}
                  checked={checkedIds.has(project.id)}
                  onChange={() => toggleChecked(project.id)}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
                />
                <label
                  htmlFor={`todoist-project-${project.id}`}
                  className="text-sm text-zinc-700 dark:text-zinc-300"
                >
                  {project.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveSelection}
            disabled={isSavingSelection || checkedIds.size === 0}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isSavingSelection ? "Saving…" : "Save"}
          </button>
          {selectedProjectIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCheckedIds(new Set(selectedProjectIds));
                setSaveError(null);
                setEditing(false);
              }}
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
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

      {taskError && <p className="text-sm text-red-600 dark:text-red-400">{taskError}</p>}
      {tasks === null ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load tasks from Todoist. Try again shortly.
        </p>
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
                onChange={() => handleToggleComplete(task.id)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
              />
              <div className="flex-1">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{task.content}</p>
                {task.dueDate && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDueDate(task.dueDate)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="self-start text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        Change projects
      </button>
    </div>
  );
}
