"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAnnualGoal, deleteAnnualGoal, type AddGoalState } from "@/app/actions/goals";
import { MAX_ANNUAL_GOALS, QUARTERS, type AnnualGoal } from "@/lib/goals-utils";
import { GoalItem } from "./GoalItem";

const initialAddState: AddGoalState = null;

export function AnnualGoalsCardBody({ goals }: { goals: AnnualGoal[] }) {
  const router = useRouter();

  const [addState, addFormAction, isAdding] = useActionState(addAnnualGoal, initialAddState);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [localGoals, setLocalGoals] = useState(goals);
  // Reset local (optimistic) goal state whenever fresh data arrives from
  // the server, following React's "adjusting state when a prop changes"
  // pattern. A successful add triggers a router.refresh() (see the effect
  // below), which is what actually changes this prop — closing the add
  // form here, rather than inside that effect, avoids calling setState
  // synchronously inside an effect (addAnnualGoal returns null on success,
  // same as its initial state, so there's no other reliable success signal
  // to key off).
  const [handledGoals, setHandledGoals] = useState(goals);
  if (goals !== handledGoals) {
    setHandledGoals(goals);
    setLocalGoals(goals);
    setShowAddForm(false);
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
  const [, startDeleteTransition] = useTransition();

  function handleDelete(goalId: string) {
    setActionError(null);
    setLocalGoals((current) => current.filter((goal) => goal.id !== goalId));
    startDeleteTransition(async () => {
      const result = await deleteAnnualGoal(goalId);
      if ("error" in result) setActionError(result.error);
      router.refresh();
    });
  }

  const atMax = localGoals.length >= MAX_ANNUAL_GOALS;

  return (
    <div className="flex flex-col gap-3">
      {actionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}

      {localGoals.length === 0 && !showAddForm ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No annual goals yet — add one below.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {localGoals.map((goal) => (
            <GoalItem key={goal.id} goal={goal} onDelete={() => handleDelete(goal.id)} />
          ))}
        </div>
      )}

      {showAddForm ? (
        <form
          ref={formRef}
          action={addFormAction}
          onSubmit={() => {
            submittedRef.current = true;
          }}
          className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
        >
          <input
            type="text"
            name="title"
            placeholder="Goal title"
            required
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          />
          <textarea
            name="description"
            rows={2}
            placeholder="Short description (optional)"
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUARTERS.map((quarter) => (
              <div key={quarter} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {quarter} target
                </label>
                <textarea
                  name={`checkpoint_${quarter}`}
                  rows={2}
                  placeholder={`${quarter} target`}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
                />
              </div>
            ))}
          </div>
          {addState?.error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{addState.error}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding}
              className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isAdding ? "Adding…" : "Add Goal"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          disabled={atMax}
          className="self-start rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {atMax ? `Max ${MAX_ANNUAL_GOALS} goals reached` : "+ Add Goal"}
        </button>
      )}
    </div>
  );
}
