"use client";

import { useState, useTransition } from "react";
import { updateMealPlanEntry } from "@/app/actions/meal-plan";
import type { DayOfWeek, MealPlanEntry } from "@/lib/meal-plan-utils";

export function MealPlanSection({ entries }: { entries: MealPlanEntry[] }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.day_of_week, entry.content])),
  );
  // Reset local edits whenever fresh data arrives from the server,
  // following React's "adjusting state when a prop changes" pattern.
  const [handledEntries, setHandledEntries] = useState(entries);
  if (entries !== handledEntries) {
    setHandledEntries(entries);
    setValues(Object.fromEntries(entries.map((entry) => [entry.day_of_week, entry.content])));
  }

  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleBlur(day: DayOfWeek, originalContent: string) {
    const content = (values[day] ?? "").trim();
    if (content === originalContent) return;

    setSaveError(null);
    startTransition(async () => {
      const result = await updateMealPlanEntry(day, content);
      if ("error" in result) setSaveError(result.error);
    });
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Weekly Meal Plan
      </h3>
      {saveError && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">{saveError}</p>
      )}
      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <div key={entry.day_of_week} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {entry.day_of_week}
            </span>
            <input
              type="text"
              value={values[entry.day_of_week] ?? ""}
              onChange={(e) =>
                setValues((current) => ({ ...current, [entry.day_of_week]: e.target.value }))
              }
              onBlur={() => handleBlur(entry.day_of_week, entry.content)}
              placeholder="What's for dinner?"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
