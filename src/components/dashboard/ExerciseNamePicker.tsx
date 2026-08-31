"use client";

import { useState } from "react";

const NEW_EXERCISE_OPTION = "__new_exercise__";

const fieldClass =
  "min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200";

// Picking from the exercises already in your history is what keeps the same
// lift from drifting into several spellings over time. Typing a brand-new
// one stays one click away, and the moment it's saved it joins the list for
// next time — so the dropdown builds itself with no separate "exercise
// library" to curate.
export function ExerciseNamePicker({
  value,
  knownNames,
  onChange,
}: {
  value: string;
  knownNames: string[];
  onChange: (name: string) => void;
}) {
  const [typingNew, setTypingNew] = useState(false);

  // Nothing to pick from on the very first workout, so skip the dropdown
  // entirely rather than showing an empty one.
  if (typingNew || knownNames.length === 0) {
    return (
      <>
        <input
          type="text"
          value={value}
          autoFocus={typingNew}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Exercise name"
          className={fieldClass}
        />
        {knownNames.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setTypingNew(false);
              onChange("");
            }}
            className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Choose existing
          </button>
        )}
      </>
    );
  }

  // A name that came from the quick-log parser (or a previous "new exercise")
  // won't be in history yet — keep it listed so the select shows it as
  // selected instead of silently snapping back to the placeholder.
  const options =
    value && !knownNames.includes(value) ? [value, ...knownNames] : knownNames;

  return (
    <select
      value={value}
      aria-label="Exercise"
      onChange={(e) => {
        if (e.target.value === NEW_EXERCISE_OPTION) {
          setTypingNew(true);
          onChange("");
          return;
        }
        onChange(e.target.value);
      }}
      className={fieldClass}
    >
      <option value="">Select exercise…</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
      <option value={NEW_EXERCISE_OPTION}>+ New exercise…</option>
    </select>
  );
}
