"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPersonalTask,
  completePersonalTask,
  type AddTaskState,
} from "@/app/actions/personal-tasks";
import type { PersonalTask } from "@/lib/personal-tasks";

const initialAddState: AddTaskState = null;

export function PersonalTasksCardBody({ tasks }: { tasks: PersonalTask[] }) {
  const router = useRouter();
  const [addState, addFormAction, isAdding] = useActionState(addPersonalTask, initialAddState);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  const [localTasks, setLocalTasks] = useState(tasks);
  // Reset local (optimistic) task state whenever fresh data arrives from the
  // server, following React's "adjusting state when a prop changes" pattern.
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

  const [taskError, setTaskError] = useState<string | null>(null);
  const [, startCompleteTransition] = useTransition();

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
          name="content"
          placeholder="Add a task"
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
        />
        <button
          type="submit"
          disabled={isAdding}
          className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isAdding ? "Adding…" : "Add"}
        </button>
      </form>

      {addState?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{addState.error}</p>
      )}
      {taskError && <p className="text-sm text-red-600 dark:text-red-400">{taskError}</p>}

      {localTasks.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No personal tasks yet.</p>
      ) : (
        <ul className="flex max-h-60 flex-col gap-3 overflow-y-auto">
          {localTasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                onChange={() => handleComplete(task.id)}
                className="h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{task.content}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
