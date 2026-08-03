"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  copyPreviousWeek,
  fetchMealPlanForWeek,
  parseMealIngredients,
  updateMealPlanEntry,
} from "@/app/actions/meal-plan";
import { addItemsToGroceryList } from "@/app/actions/grocery";
import { getLocalDateString } from "@/lib/date-utils";
import {
  DAYS_OF_WEEK,
  MEAL_MODES,
  MEAL_MODE_LABELS,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  formatWeekLabel,
  getWeekStartDate,
  slotKey,
  type DayOfWeek,
  type MealMode,
  type MealPlanEntry,
  type MealSlot,
} from "@/lib/meal-plan-utils";

function leftoverOptionValue(day: DayOfWeek, slot: MealSlot) {
  return `${day}|${slot}`;
}

function valuesFromEntries(entries: MealPlanEntry[]) {
  return Object.fromEntries(
    entries
      .filter((entry) => entry.mode === "custom")
      .map((entry) => [slotKey(entry.dayOfWeek, entry.mealSlot), entry.content]),
  );
}

export function MealPlanSection({
  initialWeekStartDate,
  initialEntries,
}: {
  initialWeekStartDate: string;
  initialEntries: MealPlanEntry[];
}) {
  const router = useRouter();

  // Renders immediately from the server's best-effort guess (its clock is
  // effectively UTC on Vercel), then silently corrects on mount below if the
  // browser's real local week differs — same "render a reasonable default,
  // upgrade once we know better" pattern as WeatherWidget's Charlotte
  // fallback, rather than blocking on a client fetch before showing anything.
  const [weekStartDate, setWeekStartDate] = useState(initialWeekStartDate);
  const [entries, setEntries] = useState<MealPlanEntry[]>(initialEntries);
  const [values, setValues] = useState<Record<string, string>>(() =>
    valuesFromEntries(initialEntries),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startSaveTransition] = useTransition();

  const [isCopying, startCopyTransition] = useTransition();
  const [copyError, setCopyError] = useState<string | null>(null);

  const [parsingKey, setParsingKey] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, startParsingTransition] = useTransition();
  const [isAddingToGrocery, startAddingTransition] = useTransition();

  function applyFetchedEntries(fetched: MealPlanEntry[]) {
    setEntries(fetched);
    setValues(valuesFromEntries(fetched));
  }

  const initialWeekRef = useRef(initialWeekStartDate);

  useEffect(() => {
    const localWeek = getWeekStartDate(getLocalDateString());
    if (localWeek === initialWeekRef.current) return;
    fetchMealPlanForWeek(localWeek).then((result) => {
      if ("error" in result) {
        setLoadError(result.error);
        return;
      }
      setWeekStartDate(localWeek);
      applyFetchedEntries(result.entries);
    });
  }, []);

  function updateEntryLocal(day: DayOfWeek, slot: MealSlot, patch: Partial<MealPlanEntry>) {
    setEntries((current) =>
      current.map((entry) =>
        entry.dayOfWeek === day && entry.mealSlot === slot ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function persistEntry(entry: MealPlanEntry) {
    setSaveError(null);
    startSaveTransition(async () => {
      const result = await updateMealPlanEntry({
        weekStartDate,
        dayOfWeek: entry.dayOfWeek,
        mealSlot: entry.mealSlot,
        mode: entry.mode,
        content: entry.content,
        leftoverDayOfWeek: entry.leftoverDayOfWeek,
        leftoverMealSlot: entry.leftoverMealSlot,
      });
      if ("error" in result) setSaveError(result.error);
    });
  }

  function handleModeChange(entry: MealPlanEntry, mode: MealMode) {
    const nextEntry: MealPlanEntry = {
      ...entry,
      mode,
      content: mode === "custom" ? entry.content : "",
      leftoverDayOfWeek: mode === "leftovers" ? entry.leftoverDayOfWeek : null,
      leftoverMealSlot: mode === "leftovers" ? entry.leftoverMealSlot : null,
    };
    updateEntryLocal(entry.dayOfWeek, entry.mealSlot, nextEntry);
    persistEntry(nextEntry);
  }

  function handleContentBlur(entry: MealPlanEntry) {
    const key = slotKey(entry.dayOfWeek, entry.mealSlot);
    const content = (values[key] ?? "").trim();
    if (content === entry.content) return;
    updateEntryLocal(entry.dayOfWeek, entry.mealSlot, { content });
    persistEntry({ ...entry, content });
  }

  function handleLeftoverChange(entry: MealPlanEntry, value: string) {
    const [day, slot] = value.split("|") as [DayOfWeek, MealSlot];
    updateEntryLocal(entry.dayOfWeek, entry.mealSlot, {
      leftoverDayOfWeek: day,
      leftoverMealSlot: slot,
    });
    persistEntry({ ...entry, leftoverDayOfWeek: day, leftoverMealSlot: slot });
  }

  function handleCopyPreviousWeek() {
    setCopyError(null);
    startCopyTransition(async () => {
      const result = await copyPreviousWeek(weekStartDate);
      if ("error" in result) {
        setCopyError(result.error);
        return;
      }
      applyFetchedEntries(result.entries);
    });
  }

  function handleStartParse(entry: MealPlanEntry) {
    if (isParsing) return;
    const key = slotKey(entry.dayOfWeek, entry.mealSlot);
    const content = (values[key] ?? entry.content).trim();
    setParsingKey(key);
    setParsedItems([]);
    if (!content) {
      setParseError("Enter a meal before adding ingredients.");
      return;
    }
    setParseError(null);
    startParsingTransition(async () => {
      const result = await parseMealIngredients(content);
      if ("error" in result) {
        setParseError(result.error);
        return;
      }
      setParsedItems(result.data);
    });
  }

  function handleCancelParse() {
    setParsingKey(null);
    setParsedItems([]);
    setParseError(null);
  }

  function updateParsedItem(index: number, value: string) {
    setParsedItems((current) => current.map((item, i) => (i === index ? value : item)));
  }

  function removeParsedItem(index: number) {
    setParsedItems((current) => current.filter((_, i) => i !== index));
  }

  function addParsedItemRow() {
    setParsedItems((current) => [...current, ""]);
  }

  function handleAddParsedItems() {
    const cleaned = parsedItems.map((item) => item.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    startAddingTransition(async () => {
      const result = await addItemsToGroceryList(cleaned);
      if ("error" in result) {
        setParseError(result.error);
        return;
      }
      setParsingKey(null);
      setParsedItems([]);
      router.refresh();
    });
  }

  const entryByKey = new Map(entries.map((entry) => [slotKey(entry.dayOfWeek, entry.mealSlot), entry]));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Weekly Meal Plan</h3>
        <button
          type="button"
          onClick={handleCopyPreviousWeek}
          disabled={isCopying}
          className="shrink-0 text-xs font-medium text-zinc-400 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          {isCopying ? "Copying…" : "Copy previous week"}
        </button>
      </div>
      <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
        {formatWeekLabel(weekStartDate)}
      </p>

      {loadError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{loadError}</p>}

      {saveError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{saveError}</p>}
      {copyError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{copyError}</p>}

      <div className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day}>
            <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{day}</p>
            <div className="flex flex-col gap-1">
              {MEAL_SLOTS.map((slot) => {
                const entry = entryByKey.get(slotKey(day, slot));
                if (!entry) return null;
                const key = slotKey(day, slot);
                const isThisParsing = parsingKey === key;

                return (
                  <div key={slot} data-testid={key} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-7 shrink-0 text-[10px] font-medium uppercase text-zinc-400 dark:text-zinc-500">
                        {MEAL_SLOT_LABELS[slot].slice(0, 3)}
                      </span>
                      <select
                        value={entry.mode}
                        onChange={(e) => handleModeChange(entry, e.target.value as MealMode)}
                        className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-xs text-zinc-600 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
                      >
                        {MEAL_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {MEAL_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>

                      {entry.mode === "custom" && (
                        <>
                          <input
                            type="text"
                            value={values[key] ?? ""}
                            onChange={(e) =>
                              setValues((current) => ({ ...current, [key]: e.target.value }))
                            }
                            onBlur={() => handleContentBlur(entry)}
                            placeholder={`${MEAL_SLOT_LABELS[slot]}…`}
                            className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleStartParse(entry)}
                            disabled={isParsing}
                            aria-label="Add ingredients to grocery list"
                            className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-300"
                          >
                            🛒
                          </button>
                        </>
                      )}

                      {entry.mode === "eating_out" && (
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Eating Out
                        </span>
                      )}

                      {entry.mode === "leftovers" && (
                        <select
                          value={
                            entry.leftoverDayOfWeek && entry.leftoverMealSlot
                              ? leftoverOptionValue(entry.leftoverDayOfWeek, entry.leftoverMealSlot)
                              : ""
                          }
                          onChange={(e) => handleLeftoverChange(entry, e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
                        >
                          <option value="">Select day &amp; meal…</option>
                          {DAYS_OF_WEEK.flatMap((refDay) =>
                            MEAL_SLOTS.filter((refSlot) => !(refDay === day && refSlot === slot)).map(
                              (refSlot) => (
                                <option
                                  key={leftoverOptionValue(refDay, refSlot)}
                                  value={leftoverOptionValue(refDay, refSlot)}
                                >
                                  {refDay} {MEAL_SLOT_LABELS[refSlot]}
                                </option>
                              ),
                            ),
                          )}
                        </select>
                      )}
                    </div>

                    {isThisParsing && (
                      <div className="ml-9 rounded-lg border border-dashed border-zinc-300 p-2 dark:border-zinc-700">
                        {isParsing ? (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">
                            Parsing ingredients…
                          </p>
                        ) : (
                          <>
                            {parseError && (
                              <p className="mb-1.5 text-xs text-red-600 dark:text-red-400">
                                {parseError}
                              </p>
                            )}
                            {!parseError && (
                              <>
                                <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  Add to Grocery List:
                                </p>
                                <div className="flex flex-col gap-1">
                                  {parsedItems.map((item, index) => (
                                    <div key={index} className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={item}
                                        onChange={(e) => updateParsedItem(index, e.target.value)}
                                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeParsedItem(index)}
                                        aria-label="Remove ingredient"
                                        className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                              {!parseError && (
                                <>
                                  <button
                                    type="button"
                                    onClick={addParsedItemRow}
                                    className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                                  >
                                    + Add ingredient
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleAddParsedItems}
                                    disabled={isAddingToGrocery || parsedItems.length === 0}
                                    className="text-xs font-medium text-zinc-700 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-100"
                                  >
                                    {isAddingToGrocery ? "Adding…" : "Add to Grocery List"}
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={handleCancelParse}
                                className="text-xs text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                              >
                                {parseError ? "Close" : "Cancel"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
