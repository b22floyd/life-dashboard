"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGoalCheckinNote,
  setCheckpointComplete,
  updateAnnualGoal,
} from "@/app/actions/goals";
import { useHasMounted } from "@/lib/use-has-mounted";
import { QUARTERS, computeGoalProgress, type AnnualGoal, type Quarter } from "@/lib/goals-utils";

function checkpointDescriptionsOf(goal: AnnualGoal): Record<Quarter, string> {
  return Object.fromEntries(
    goal.checkpoints.map((checkpoint) => [checkpoint.quarter, checkpoint.targetDescription]),
  ) as Record<Quarter, string>;
}

// createdAt is an absolute instant, so formatting it is timezone-dependent —
// only called once mounted, same as every other absolute-timestamp display
// in this app (see Timezones in the README).
function formatNoteTimestamp(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GoalItem({ goal, onDelete }: { goal: AnnualGoal; onDelete: () => void }) {
  const router = useRouter();
  const mounted = useHasMounted();

  const [localGoal, setLocalGoal] = useState(goal);
  // Reset local (optimistic) goal state whenever fresh data arrives from
  // the server, following React's "adjusting state when a prop changes" pattern.
  const [handledGoal, setHandledGoal] = useState(goal);
  if (goal !== handledGoal) {
    setHandledGoal(goal);
    setLocalGoal(goal);
  }

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editDescription, setEditDescription] = useState(goal.description);
  const [editCheckpoints, setEditCheckpoints] = useState<Record<Quarter, string>>(() =>
    checkpointDescriptionsOf(goal),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  const [toggleError, setToggleError] = useState<string | null>(null);
  const [, startToggleTransition] = useTransition();

  // Checkpoint targets can contain sensitive detail (e.g. dollar amounts),
  // so the card shows only title, description, and the progress bar by
  // default — checkpoints and check-in notes stay hidden until expanded.
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const [notesExpanded, setNotesExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isAddingNote, startNoteTransition] = useTransition();

  function startEditing() {
    setEditTitle(localGoal.title);
    setEditDescription(localGoal.description);
    setEditCheckpoints(checkpointDescriptionsOf(localGoal));
    setSaveError(null);
    setIsEditing(true);
  }

  function handleSaveEdit() {
    const title = editTitle.trim();
    if (!title) {
      setSaveError("Goal title can't be empty.");
      return;
    }
    setSaveError(null);
    const description = editDescription.trim();
    setLocalGoal((current) => ({
      ...current,
      title,
      description,
      checkpoints: current.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        targetDescription: editCheckpoints[checkpoint.quarter].trim(),
      })),
    }));
    setIsEditing(false);
    startSaveTransition(async () => {
      const result = await updateAnnualGoal(localGoal.id, {
        title,
        description,
        checkpointDescriptions: editCheckpoints,
      });
      if ("error" in result) setSaveError(result.error);
      router.refresh();
    });
  }

  function handleToggleCheckpoint(checkpointId: string, completed: boolean) {
    setToggleError(null);
    setLocalGoal((current) => ({
      ...current,
      checkpoints: current.checkpoints.map((checkpoint) =>
        checkpoint.id === checkpointId
          ? { ...checkpoint, completed, completedAt: completed ? new Date().toISOString() : null }
          : checkpoint,
      ),
    }));
    startToggleTransition(async () => {
      const result = await setCheckpointComplete(checkpointId, completed);
      if ("error" in result) setToggleError(result.error);
      router.refresh();
    });
  }

  function handleAddNote() {
    const note = noteText.trim();
    if (!note) return;
    setNoteError(null);
    const optimisticNote = {
      id: `optimistic-${Date.now()}`,
      note,
      createdAt: new Date().toISOString(),
    };
    setLocalGoal((current) => ({ ...current, notes: [optimisticNote, ...current.notes] }));
    setNoteText("");
    startNoteTransition(async () => {
      const result = await addGoalCheckinNote(localGoal.id, note);
      if ("error" in result) setNoteError(result.error);
      router.refresh();
    });
  }

  const { completed, total } = computeGoalProgress(localGoal);

  return (
    <div
      data-testid={`goal-${goal.id}`}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
    >
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Goal title"
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm font-medium text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={2}
            placeholder="Short description"
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
          />
          <div className="grid grid-cols-2 gap-2">
            {QUARTERS.map((quarter) => (
              <div key={quarter} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {quarter}
                </label>
                <textarea
                  value={editCheckpoints[quarter]}
                  onChange={(e) =>
                    setEditCheckpoints((current) => ({ ...current, [quarter]: e.target.value }))
                  }
                  rows={2}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                />
              </div>
            ))}
          </div>
          {saveError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {localGoal.title}
              </h3>
              {localGoal.description && (
                <p className="mt-0.5 text-sm break-words text-zinc-500 dark:text-zinc-400">
                  {localGoal.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={startEditing}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete goal"
                className="text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </div>

          <div>
            <div className="flex gap-1">
              {localGoal.checkpoints.map((checkpoint) => (
                <div
                  key={checkpoint.quarter}
                  className={
                    checkpoint.completed
                      ? "h-1.5 flex-1 rounded-full bg-emerald-500 dark:bg-emerald-400"
                      : "h-1.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700"
                  }
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {completed}/{total} checkpoints complete
            </p>
          </div>

          <div className="mt-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDetailsExpanded((expanded) => !expanded)}
              aria-expanded={detailsExpanded}
              className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              <span>{detailsExpanded ? "▾" : "▸"}</span>
              Checkpoints & Notes
            </button>
          </div>

          {detailsExpanded && (
            <>
              {toggleError && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">{toggleError}</p>
              )}

              <div className="flex flex-col gap-1.5">
                {localGoal.checkpoints.map((checkpoint) => (
                  <label key={checkpoint.quarter} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checkpoint.completed}
                      onChange={() => handleToggleCheckpoint(checkpoint.id, !checkpoint.completed)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
                    />
                    <span className="text-sm">
                      <span className="font-medium text-zinc-600 dark:text-zinc-300">
                        {checkpoint.quarter}:
                      </span>{" "}
                      <span
                        className={
                          checkpoint.completed
                            ? "text-zinc-400 line-through dark:text-zinc-500"
                            : "text-zinc-700 dark:text-zinc-300"
                        }
                      >
                        {checkpoint.targetDescription || (
                          <span className="italic text-zinc-400 dark:text-zinc-500">
                            No target set
                          </span>
                        )}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setNotesExpanded((expanded) => !expanded)}
                  aria-expanded={notesExpanded}
                  className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                >
                  <span>{notesExpanded ? "▾" : "▸"}</span>
                  Check-in Notes{localGoal.notes.length > 0 && ` (${localGoal.notes.length})`}
                </button>

                {notesExpanded && (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={2}
                        placeholder="Add a check-in note…"
                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
                      />
                      <button
                        type="button"
                        onClick={handleAddNote}
                        disabled={isAddingNote || !noteText.trim()}
                        className="self-start rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        {isAddingNote ? "Adding…" : "Add"}
                      </button>
                    </div>
                    {noteError && (
                      <p role="alert" className="text-xs text-red-600 dark:text-red-400">{noteError}</p>
                    )}
                    {localGoal.notes.length === 0 ? (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        No check-in notes yet.
                      </p>
                    ) : (
                      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                        {localGoal.notes.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60"
                          >
                            <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                              {mounted ? formatNoteTimestamp(note.createdAt) : "…"}
                            </p>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300">{note.note}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
