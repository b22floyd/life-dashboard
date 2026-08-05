"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteWorkoutSession,
  parseWorkoutText,
  saveWorkoutSession,
  type ParseWorkoutState,
} from "@/app/actions/workout";
import { getLocalDateString } from "@/lib/date-utils";
import { WORKOUT_CATEGORIES, type WorkoutCategory, type WorkoutSession } from "@/lib/workout-utils";
import { WidgetCard } from "./WidgetCard";
import { ProgressChart } from "./ProgressChart";

const initialParseState: ParseWorkoutState = null;

type EditableSet = { weight: string; reps: string };
type EditableExercise = { name: string; sets: EditableSet[] };

function emptySet(): EditableSet {
  return { weight: "", reps: "" };
}

function emptyExercise(): EditableExercise {
  return { name: "", sets: [emptySet()] };
}

function formatSessionDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function WorkoutCard({ sessions }: { sessions: WorkoutSession[] }) {
  const [parseState, parseFormAction, parsing] = useActionState(
    parseWorkoutText,
    initialParseState,
  );
  const parseFormRef = useRef<HTMLFormElement>(null);

  const [sessionName, setSessionName] = useState("");
  const [category, setCategory] = useState<WorkoutCategory | null>(null);
  const [exercises, setExercises] = useState<EditableExercise[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const router = useRouter();

  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  const [localSessions, setLocalSessions] = useState(sessions);
  // Reset local (optimistic) session state whenever fresh data arrives from
  // the server, following React's "adjusting state when a prop changes" pattern.
  const [handledSessions, setHandledSessions] = useState(sessions);
  if (sessions !== handledSessions) {
    setHandledSessions(sessions);
    setLocalSessions(sessions);
  }

  function handleDeleteSession(sessionId: string) {
    setDeleteError(null);
    setLocalSessions((current) => current.filter((session) => session.id !== sessionId));
    startDeleteTransition(async () => {
      const result = await deleteWorkoutSession(sessionId);
      if ("error" in result) {
        setDeleteError(result.error);
      }
      router.refresh();
    });
  }

  // Adjust local editor state when a new parse result arrives, following React's
  // "adjusting state when a prop changes" pattern rather than an effect + setState.
  const [handledParseState, setHandledParseState] = useState(parseState);
  if (parseState !== handledParseState) {
    setHandledParseState(parseState);
    if (parseState && "data" in parseState) {
      setSessionName(parseState.data.name ?? "");
      setExercises(
        parseState.data.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets.map((set) => ({
            weight: String(set.weight),
            reps: String(set.reps),
          })),
        })),
      );
      setSaveError(null);
    }
  }

  useEffect(() => {
    if (parseState && "data" in parseState) {
      parseFormRef.current?.reset();
    }
  }, [parseState]);

  function updateExercise(index: number, patch: Partial<EditableExercise>) {
    setExercises((current) =>
      current.map((exercise, i) => (i === index ? { ...exercise, ...patch } : exercise)),
    );
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<EditableSet>) {
    setExercises((current) =>
      current.map((exercise, i) => {
        if (i !== exerciseIndex) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)),
        };
      }),
    );
  }

  function addExercise() {
    setExercises((current) => [...current, emptyExercise()]);
  }

  function removeExercise(index: number) {
    setExercises((current) => current.filter((_, i) => i !== index));
  }

  function addSet(exerciseIndex: number) {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex ? { ...exercise, sets: [...exercise.sets, emptySet()] } : exercise,
      ),
    );
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? { ...exercise, sets: exercise.sets.filter((_, j) => j !== setIndex) }
          : exercise,
      ),
    );
  }

  function handleSave() {
    setSaveError(null);

    if (!category) {
      setSaveError("Select a category before saving.");
      return;
    }

    const cleaned = exercises
      .map((exercise) => ({
        name: exercise.name.trim(),
        sets: exercise.sets
          .filter((set) => set.weight.trim() !== "" || set.reps.trim() !== "")
          .map((set) => ({ weight: Number(set.weight), reps: Number(set.reps) })),
      }))
      .filter((exercise) => exercise.name && exercise.sets.length > 0);

    if (cleaned.length === 0) {
      setSaveError("Add at least one exercise with a set before saving.");
      return;
    }

    if (cleaned.some((exercise) => exercise.sets.some((set) => Number.isNaN(set.weight) || Number.isNaN(set.reps)))) {
      setSaveError("Weight and reps must be numbers.");
      return;
    }

    startSaveTransition(async () => {
      const result = await saveWorkoutSession({
        name: sessionName.trim() || null,
        category,
        sessionDate: getLocalDateString(),
        exercises: cleaned,
      });
      if ("error" in result) {
        setSaveError(result.error);
        return;
      }
      setSessionName("");
      setCategory(null);
      setExercises([]);
      router.refresh();
    });
  }

  return (
    <WidgetCard title="Weight Training" className="lg:col-span-3" id="workout-section">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <form ref={parseFormRef} action={parseFormAction} className="mb-4 flex flex-col gap-3">
            <textarea
              name="description"
              rows={3}
              placeholder='Quick log: "bench press three sets, 135 for 10, 145 for 8, 155 for 6, then squats 225 for 5 three times"'
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
            />
            {parseState && "error" in parseState && (
              <p className="text-sm text-red-600 dark:text-red-400">{parseState.error}</p>
            )}
            <button
              type="submit"
              disabled={parsing}
              className="self-end rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {parsing ? "Parsing…" : "Parse"}
            </button>
          </form>

          <div className="mb-3 flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Session name (optional)
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Push Day"
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
            />
          </div>

          <div className="mb-3 flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {WORKOUT_CATEGORIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCategory((current) => (current === option ? null : option));
                    setSaveError(null);
                  }}
                  className={
                    category === option
                      ? "rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {exercises.map((exercise, exerciseIndex) => (
              <div
                key={exerciseIndex}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={exercise.name}
                    onChange={(e) => updateExercise(exerciseIndex, { name: e.target.value })}
                    placeholder="Exercise name"
                    className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeExercise(exerciseIndex)}
                    className="text-sm text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                    aria-label="Remove exercise"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {exercise.sets.map((set, setIndex) => (
                    <div key={setIndex} className="flex items-center gap-2">
                      <span className="w-5 text-xs text-zinc-400 dark:text-zinc-500">
                        {setIndex + 1}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={set.weight}
                        onChange={(e) =>
                          updateSet(exerciseIndex, setIndex, { weight: e.target.value })
                        }
                        placeholder="Weight"
                        className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
                      />
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">lb ×</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.reps}
                        onChange={(e) =>
                          updateSet(exerciseIndex, setIndex, { reps: e.target.value })
                        }
                        placeholder="Reps"
                        className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeSet(exerciseIndex, setIndex)}
                        className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                        aria-label="Remove set"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addSet(exerciseIndex)}
                    className="self-start text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    + Add Set
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addExercise}
              className="self-start rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              + Add Exercise
            </button>
          </div>

          {saveError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{saveError}</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || exercises.length === 0}
            className="mt-4 self-end rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isSaving ? "Saving…" : "Save Workout"}
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <ProgressChart sessions={localSessions} />
          </div>

          <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setHistoryExpanded((expanded) => !expanded)}
              aria-expanded={historyExpanded}
              className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              <span>{historyExpanded ? "▾" : "▸"}</span>
              Session History{localSessions.length > 0 && ` (${localSessions.length})`}
            </button>

            {deleteError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}

            {historyExpanded && (
              <div className="mt-3 flex max-h-96 flex-col gap-3 overflow-y-auto">
                {localSessions.length === 0 && (
                  <p className="text-sm text-zinc-400 dark:text-zinc-500">
                    No workouts logged yet.
                  </p>
                )}
                {localSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {formatSessionDate(session.session_date)}
                        {session.name ? ` — ${session.name}` : ""}
                        {session.category && (
                          <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                            {session.category}
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(session.id)}
                        className="shrink-0 text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                        aria-label="Delete session"
                      >
                        Delete
                      </button>
                    </div>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {session.exercises.map((exercise) => (
                        <li key={exercise.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                          <span className="font-medium">{exercise.exercise_name}</span>{" "}
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {exercise.sets
                              .map((set) => `${set.weight}×${set.reps}`)
                              .join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
