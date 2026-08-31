"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addHabit,
  deleteHabit,
  renameHabit,
  reorderHabit,
  setHabitCompletion,
  type AddHabitState,
} from "@/app/actions/habits";
import { getLocalDateString } from "@/lib/date-utils";
import {
  computeHabitStreaks,
  getChainCalendar,
  type HabitWithCompletions,
} from "@/lib/habit-utils";
import { useHasMounted } from "@/lib/use-has-mounted";

const initialAddState: AddHabitState = null;

export function HabitsCardBody({ habits }: { habits: HabitWithCompletions[] }) {
  // Streaks and the chain calendar depend on the device's local "today",
  // which a Server Component can't know — wait until mount rather than
  // risk computing them using the server's (often UTC) clock.
  const mounted = useHasMounted();
  const router = useRouter();

  const [addState, addFormAction, isAdding] = useActionState(addHabit, initialAddState);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  const [localHabits, setLocalHabits] = useState(habits);
  // Reset local (optimistic) habit state whenever fresh data arrives from
  // the server, following React's "adjusting state when a prop changes" pattern.
  const [handledHabits, setHandledHabits] = useState(habits);
  if (habits !== handledHabits) {
    setHandledHabits(habits);
    setLocalHabits(habits);
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

  function handleToggle(habit: HabitWithCompletions, today: string) {
    setActionError(null);
    const isDone = habit.completedDates.includes(today);
    setLocalHabits((current) =>
      current.map((h) =>
        h.id === habit.id
          ? {
              ...h,
              completedDates: isDone
                ? h.completedDates.filter((d) => d !== today)
                : [...h.completedDates, today],
            }
          : h,
      ),
    );
    startActionTransition(async () => {
      const result = await setHabitCompletion(habit.id, today, !isDone);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleDelete(habitId: string) {
    setActionError(null);
    setLocalHabits((current) => current.filter((h) => h.id !== habitId));
    startActionTransition(async () => {
      const result = await deleteHabit(habitId);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function handleReorder(habitId: string, direction: "up" | "down") {
    setActionError(null);
    setLocalHabits((current) => {
      const index = current.findIndex((h) => h.id === habitId);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || swapIndex < 0 || swapIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
    startActionTransition(async () => {
      const result = await reorderHabit(habitId, direction);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  function startEditing(habit: HabitWithCompletions) {
    setEditingId(habit.id);
    setEditingName(habit.name);
  }

  function saveEditing() {
    if (!editingId) return;
    const habitId = editingId;
    const name = editingName.trim();
    setEditingId(null);
    if (!name) return;

    setLocalHabits((current) =>
      current.map((h) => (h.id === habitId ? { ...h, name } : h)),
    );
    startActionTransition(async () => {
      const result = await renameHabit(habitId, name);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  const today = mounted ? getLocalDateString() : null;
  // Display-only filter — streaks, best streak, and the chain calendar are
  // all still computed from the full habit (including today's completion),
  // so a habit that reappears tomorrow shows exactly the same history it
  // would have if it had stayed visible today.
  const visibleHabits = today ? localHabits.filter((h) => !h.completedDates.includes(today)) : [];

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
          aria-label="Habit name"
          placeholder="Add a habit"
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
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{addState.error}</p>
      )}
      {actionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}

      {!mounted ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading…</p>
      ) : localHabits.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No habits yet — add one above.</p>
      ) : visibleHabits.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">All habits done for today.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {visibleHabits.map((habit) => {
            const fullIndex = localHabits.findIndex((h) => h.id === habit.id);
            const { current, best } = computeHabitStreaks(habit, today!);
            const chain = getChainCalendar(habit, today!);

            return (
              <li key={habit.id} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col text-[10px] leading-none text-zinc-400 dark:text-zinc-500">
                    <button
                      type="button"
                      onClick={() => handleReorder(habit.id, "up")}
                      disabled={fullIndex === 0}
                      aria-label="Move up"
                      className="hover:text-zinc-700 disabled:opacity-30 dark:hover:text-zinc-300"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(habit.id, "down")}
                      disabled={fullIndex === localHabits.length - 1}
                      aria-label="Move down"
                      className="hover:text-zinc-700 disabled:opacity-30 dark:hover:text-zinc-300"
                    >
                      ▼
                    </button>
                  </div>

                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => handleToggle(habit, today!)}
                    className="h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
                  />

                  {editingId === habit.id ? (
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
                      onClick={() => startEditing(habit)}
                      className="min-w-0 flex-1 truncate text-left text-sm text-zinc-700 hover:underline dark:text-zinc-300"
                    >
                      {habit.name}
                    </button>
                  )}

                  <span className="shrink-0 whitespace-nowrap rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    🔥{current} · best {best}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDelete(habit.id)}
                    aria-label="Delete habit"
                    className="shrink-0 text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-1.5 flex flex-wrap gap-[3px]">
                  {chain.map((day) => (
                    <span
                      key={day.date}
                      title={day.date}
                      className={
                        day.done
                          ? "h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
                          : "h-1.5 w-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700"
                      }
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
