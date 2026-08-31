// @vitest-environment jsdom
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkoutCard } from "./WorkoutCard";
import { getLocalDateString } from "@/lib/date-utils";
import type { WorkoutSession } from "@/lib/workout-utils";

const { saveWorkoutSessionMock, deleteWorkoutSessionMock, parseWorkoutTextMock, mergeExercisesMock, refreshMock } =
  vi.hoisted(() => ({
    saveWorkoutSessionMock: vi.fn(),
    deleteWorkoutSessionMock: vi.fn(),
    parseWorkoutTextMock: vi.fn(),
    mergeExercisesMock: vi.fn(),
    refreshMock: vi.fn(),
  }));

// Server Actions reach a real Supabase/Anthropic client — mocked the same
// way every other Server-Action-backed component test in this suite does.
vi.mock("@/app/actions/workout", () => ({
  saveWorkoutSession: saveWorkoutSessionMock,
  deleteWorkoutSession: deleteWorkoutSessionMock,
  parseWorkoutText: parseWorkoutTextMock,
  mergeExercises: mergeExercisesMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

function priorSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "prior-1",
    session_date: "2026-08-01",
    name: "Push Day",
    category: "Chest",
    created_at: "2026-08-01T12:00:00.000Z",
    exercises: [
      {
        id: "ex-1",
        exercise_name: "Bench Press",
        position: 0,
        // Epley 1RM: 100 * (1 + 10/30) = 133.33
        sets: [{ id: "set-1", set_number: 1, weight: 100, reps: 10 }],
      },
    ],
    ...overrides,
  };
}

// The Category label/buttons and Session History both have same-named
// counterparts elsewhere on the card (ProgressChart renders its own
// category tabs; ExerciseManager's merge picker lists known exercise
// names too) — scoping into these two containers avoids colliding with
// either.
function categoryPicker() {
  return screen.getByText("Category").closest("div") as HTMLElement;
}

function historySection() {
  return screen.getByRole("button", { name: /Session History/ }).closest("div") as HTMLElement;
}

// With no prior sessions, ExerciseNamePicker's "known names" list is empty
// and it renders a plain text input; once history has an exercise in it,
// picking that same name again goes through a <select> instead (see
// ExerciseNamePicker.tsx) — this fills in whichever shape is showing.
async function setExerciseName(user: ReturnType<typeof userEvent.setup>, name: string) {
  const textInput = screen.queryByPlaceholderText("Exercise name");
  if (textInput) {
    await user.type(textInput, name);
    return;
  }
  await user.selectOptions(screen.getByRole("combobox", { name: "Exercise" }), name);
}

async function addExerciseWithSet(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  weight: string,
  reps: string,
) {
  await user.click(screen.getByRole("button", { name: "+ Add Exercise" }));
  await setExerciseName(user, name);
  await user.type(screen.getByPlaceholderText("Weight"), weight);
  await user.type(screen.getByPlaceholderText("Reps"), reps);
}

beforeEach(() => {
  saveWorkoutSessionMock.mockReset();
  deleteWorkoutSessionMock.mockReset();
  parseWorkoutTextMock.mockReset().mockResolvedValue(null);
  mergeExercisesMock.mockReset();
  refreshMock.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WorkoutCard", () => {
  it("requires a category before saving", async () => {
    const user = userEvent.setup();
    render(<WorkoutCard sessions={[]} />);
    await addExerciseWithSet(user, "Squat", "150", "10");

    await user.click(screen.getByRole("button", { name: "Save Workout" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Select a category before saving.");
    expect(saveWorkoutSessionMock).not.toHaveBeenCalled();
  });

  it("saves a valid session, adds it optimistically, and clears the form", async () => {
    saveWorkoutSessionMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<WorkoutCard sessions={[]} />);

    await user.click(within(categoryPicker()).getByRole("button", { name: "Chest" }));
    await addExerciseWithSet(user, "Squat", "150", "10");
    await user.click(screen.getByRole("button", { name: "Save Workout" }));

    await waitFor(() => expect(saveWorkoutSessionMock).toHaveBeenCalledTimes(1));
    expect(saveWorkoutSessionMock).toHaveBeenCalledWith({
      name: null,
      category: "Chest",
      sessionDate: getLocalDateString(),
      exercises: [{ name: "Squat", sets: [{ weight: 150, reps: 10 }] }],
    });

    // Optimistic entry shows immediately in Session History, before the
    // Server Action even resolves.
    await user.click(screen.getByRole("button", { name: /Session History/ }));
    expect(within(historySection()).getByText("Squat")).toBeInTheDocument();

    // Form is cleared for the next entry.
    expect(screen.getByPlaceholderText("Push Day")).toHaveValue("");
    expect(screen.queryByPlaceholderText("Exercise name")).not.toBeInTheDocument();
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("shows a new-PR banner only when the new session beats prior history — measured against history as it stood before this save", async () => {
    const user = userEvent.setup();
    saveWorkoutSessionMock.mockResolvedValue({ success: true });
    // Prior best for Bench Press: 100lb x10 -> ~133.3 est. 1RM.
    render(<WorkoutCard sessions={[priorSession()]} />);

    await user.click(within(categoryPicker()).getByRole("button", { name: "Chest" }));
    // 150lb x10 -> 200 est. 1RM, well above the prior 133.3 -> a real PR.
    await addExerciseWithSet(user, "Bench Press", "150", "10");

    await user.click(screen.getByRole("button", { name: "Save Workout" }));

    expect(await screen.findByText(/New personal record/)).toBeInTheDocument();
    expect(screen.getByText(/200 lb est\. 1RM/)).toBeInTheDocument();
    expect(screen.getByText(/up from 133 lb/)).toBeInTheDocument();
  });

  it("does not show a PR banner when the new session doesn't beat prior history", async () => {
    const user = userEvent.setup();
    saveWorkoutSessionMock.mockResolvedValue({ success: true });
    render(<WorkoutCard sessions={[priorSession()]} />);

    await user.click(within(categoryPicker()).getByRole("button", { name: "Chest" }));
    // 90lb x10 -> 120 est. 1RM, below the prior 133.3 -> not a PR.
    await addExerciseWithSet(user, "Bench Press", "90", "10");

    await user.click(screen.getByRole("button", { name: "Save Workout" }));

    await waitFor(() => expect(saveWorkoutSessionMock).toHaveBeenCalled());
    expect(screen.queryByText(/New personal record/)).not.toBeInTheDocument();
  });

  it("on save failure, restores the exact form contents and drops the optimistic entry", async () => {
    saveWorkoutSessionMock.mockResolvedValue({ error: "The server rejected that session." });
    const user = userEvent.setup();
    render(<WorkoutCard sessions={[]} />);

    await user.type(screen.getByPlaceholderText("Push Day"), "Leg Day");
    await user.click(within(categoryPicker()).getByRole("button", { name: "Chest" }));
    await addExerciseWithSet(user, "Squat", "150", "10");
    await user.click(screen.getByRole("button", { name: "Save Workout" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("The server rejected that session."),
    );

    // Form restored exactly, not just "still has something in it."
    expect(screen.getByDisplayValue("Leg Day")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Squat")).toBeInTheDocument();
    expect(screen.getByDisplayValue("150")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();

    // No leftover optimistic session in history.
    await user.click(screen.getByRole("button", { name: /Session History/ }));
    expect(within(historySection()).getByText("No workouts logged yet.")).toBeInTheDocument();
  });

  it("asks for confirmation before deleting a session, and does nothing if declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<WorkoutCard sessions={[priorSession()]} />);

    await user.click(screen.getByRole("button", { name: /Session History/ }));
    await user.click(screen.getByRole("button", { name: "Delete session" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteWorkoutSessionMock).not.toHaveBeenCalled();
    expect(within(historySection()).getByText("Bench Press")).toBeInTheDocument();
  });

  it("deletes a session optimistically once confirmed", async () => {
    deleteWorkoutSessionMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<WorkoutCard sessions={[priorSession()]} />);

    await user.click(screen.getByRole("button", { name: /Session History/ }));
    await user.click(screen.getByRole("button", { name: "Delete session" }));

    expect(deleteWorkoutSessionMock).toHaveBeenCalledWith("prior-1");
    await waitFor(() =>
      expect(within(historySection()).getByText("No workouts logged yet.")).toBeInTheDocument(),
    );
  });

  it("shows a load error state when sessions is null but the compose form still works", () => {
    render(<WorkoutCard sessions={null} />);
    expect(screen.getByText(/Couldn't load your workout history/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Workout" })).toBeInTheDocument();
  });
});
