// @vitest-environment jsdom
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MealPlanSection } from "./MealPlanSection";
import { getLocalDateString } from "@/lib/date-utils";
import {
  DAYS_OF_WEEK,
  MEAL_SLOTS,
  getWeekStartDate,
  slotKey,
  type MealPlanEntry,
} from "@/lib/meal-plan-utils";

const {
  fetchMealPlanForWeekMock,
  copyPreviousWeekMock,
  parseMealIngredientsMock,
  updateMealPlanEntryMock,
  addItemsToGroceryListMock,
  refreshMock,
} = vi.hoisted(() => ({
  fetchMealPlanForWeekMock: vi.fn(),
  copyPreviousWeekMock: vi.fn(),
  parseMealIngredientsMock: vi.fn(),
  updateMealPlanEntryMock: vi.fn(),
  addItemsToGroceryListMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/app/actions/meal-plan", () => ({
  fetchMealPlanForWeek: fetchMealPlanForWeekMock,
  copyPreviousWeek: copyPreviousWeekMock,
  parseMealIngredients: parseMealIngredientsMock,
  updateMealPlanEntry: updateMealPlanEntryMock,
}));

vi.mock("@/app/actions/grocery", () => ({
  addItemsToGroceryList: addItemsToGroceryListMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

// The current week's real Sunday (in this test runner's own timezone),
// matching what the component's own on-mount "did the local week differ
// from the server's guess" effect would compute — passing this in as
// initialWeekStartDate means that effect finds no difference and never
// fires its own fetchMealPlanForWeek call, keeping each test's fixture in
// full control of what's rendered.
const CURRENT_WEEK_START = getWeekStartDate(getLocalDateString());

function emptyWeek(): MealPlanEntry[] {
  return DAYS_OF_WEEK.flatMap((day) =>
    MEAL_SLOTS.map((slot) => ({
      weekStartDate: CURRENT_WEEK_START,
      dayOfWeek: day,
      mealSlot: slot,
      mode: "custom" as const,
      content: "",
      leftoverDayOfWeek: null,
      leftoverMealSlot: null,
    })),
  );
}

function withEntry(entries: MealPlanEntry[], patch: Partial<MealPlanEntry> & Pick<MealPlanEntry, "dayOfWeek" | "mealSlot">) {
  return entries.map((entry) =>
    entry.dayOfWeek === patch.dayOfWeek && entry.mealSlot === patch.mealSlot
      ? { ...entry, ...patch }
      : entry,
  );
}

function slot(day: (typeof DAYS_OF_WEEK)[number], mealSlot: (typeof MEAL_SLOTS)[number]) {
  return screen.getByTestId(slotKey(day, mealSlot));
}

beforeEach(() => {
  fetchMealPlanForWeekMock.mockReset();
  copyPreviousWeekMock.mockReset();
  parseMealIngredientsMock.mockReset();
  updateMealPlanEntryMock.mockReset();
  addItemsToGroceryListMock.mockReset();
  refreshMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MealPlanSection", () => {
  it("shows a load error when the initial fetch failed", () => {
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={null} />);
    expect(screen.getByText(/Couldn't load this week's meal plan/)).toBeInTheDocument();
  });

  it("saves an edited meal on blur and calls router.refresh regardless of outcome", async () => {
    updateMealPlanEntryMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={emptyWeek()} />);

    const input = within(slot("Monday", "dinner")).getByPlaceholderText("Dinner…");
    await user.type(input, "Tacos");
    await user.tab(); // blur

    await waitFor(() => expect(updateMealPlanEntryMock).toHaveBeenCalledTimes(1));
    expect(updateMealPlanEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStartDate: CURRENT_WEEK_START,
        dayOfWeek: "Monday",
        mealSlot: "dinner",
        mode: "custom",
        content: "Tacos",
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  // persistEntry calls router.refresh() unconditionally, on both success and
  // failure — the failure path is what actually reverts an optimistic edit
  // back to server truth. A refactor that only refreshes on success would
  // leave a failed edit stuck showing as if it saved.
  it("still calls router.refresh on a save failure, and shows the error", async () => {
    updateMealPlanEntryMock.mockResolvedValue({ error: "Couldn't save that meal." });
    const user = userEvent.setup();
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={emptyWeek()} />);

    const input = within(slot("Tuesday", "lunch")).getByPlaceholderText("Lunch…");
    await user.type(input, "Salad");
    await user.tab();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save that meal."),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("switching a slot to Eating Out clears its content and persists immediately", async () => {
    updateMealPlanEntryMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    const entries = withEntry(emptyWeek(), { dayOfWeek: "Wednesday", mealSlot: "breakfast", content: "Oatmeal" });
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={entries} />);

    const select = within(slot("Wednesday", "breakfast")).getByRole("combobox");
    await user.selectOptions(select, "eating_out");

    expect(within(slot("Wednesday", "breakfast")).getByText("Eating Out", { selector: "span" })).toBeInTheDocument();
    await waitFor(() =>
      expect(updateMealPlanEntryMock).toHaveBeenCalledWith(
        expect.objectContaining({ dayOfWeek: "Wednesday", mealSlot: "breakfast", mode: "eating_out", content: "" }),
      ),
    );
  });

  it("copying the previous week replaces every entry on success", async () => {
    const copiedEntries = withEntry(emptyWeek(), {
      dayOfWeek: "Friday",
      mealSlot: "dinner",
      content: "Copied Meal",
    });
    copyPreviousWeekMock.mockResolvedValue({ entries: copiedEntries });
    const user = userEvent.setup();
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={emptyWeek()} />);

    await user.click(screen.getByRole("button", { name: "Copy previous week" }));

    await waitFor(() =>
      expect(within(slot("Friday", "dinner")).getByDisplayValue("Copied Meal")).toBeInTheDocument(),
    );
  });

  it("shows an error and leaves entries alone when copying the previous week fails", async () => {
    copyPreviousWeekMock.mockResolvedValue({ error: "Nothing to copy." });
    const user = userEvent.setup();
    const entries = withEntry(emptyWeek(), { dayOfWeek: "Sunday", mealSlot: "breakfast", content: "Pancakes" });
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={entries} />);

    await user.click(screen.getByRole("button", { name: "Copy previous week" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Nothing to copy."));
    expect(within(slot("Sunday", "breakfast")).getByDisplayValue("Pancakes")).toBeInTheDocument();
  });

  it("requires a meal description before parsing ingredients", async () => {
    const user = userEvent.setup();
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={emptyWeek()} />);

    await user.click(within(slot("Sunday", "dinner")).getByRole("button", { name: "Add ingredients to grocery list" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a meal before adding ingredients.");
    expect(parseMealIngredientsMock).not.toHaveBeenCalled();
  });

  it("parses ingredients for a filled-in meal and lists them for review", async () => {
    parseMealIngredientsMock.mockResolvedValue({ data: ["ground beef", "taco shells"] });
    const user = userEvent.setup();
    const entries = withEntry(emptyWeek(), { dayOfWeek: "Monday", mealSlot: "dinner", content: "Tacos" });
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={entries} />);

    await user.click(within(slot("Monday", "dinner")).getByRole("button", { name: "Add ingredients to grocery list" }));

    expect(await screen.findByDisplayValue("ground beef")).toBeInTheDocument();
    expect(screen.getByDisplayValue("taco shells")).toBeInTheDocument();
    expect(parseMealIngredientsMock).toHaveBeenCalledWith("Tacos");
  });

  // handleAddParsedItems deliberately closes the ingredient panel and clears
  // its local state *before* the Server Action resolves, so a failure has
  // nowhere left to show inline — it has to surface through the persistent
  // top-level groceryAddError banner instead, or it would be silently lost.
  // A mock that resolves instantly can't actually distinguish "closes
  // before the call" from "closes after" (both look instantaneous), so this
  // holds the Server Action open with a manually-resolved promise to check
  // the panel is already gone *before* it's allowed to resolve.
  it("closes the ingredient panel immediately, before the Server Action resolves", async () => {
    parseMealIngredientsMock.mockResolvedValue({ data: ["ground beef"] });
    let resolveAdd!: (value: { error: string }) => void;
    addItemsToGroceryListMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAdd = resolve;
      }),
    );
    const user = userEvent.setup();
    const entries = withEntry(emptyWeek(), { dayOfWeek: "Monday", mealSlot: "dinner", content: "Tacos" });
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={entries} />);

    await user.click(within(slot("Monday", "dinner")).getByRole("button", { name: "Add ingredients to grocery list" }));
    await screen.findByDisplayValue("ground beef");
    await user.click(screen.getByRole("button", { name: "Add to Grocery List" }));

    // The Server Action call is still pending at this point — the panel
    // must already be gone, not waiting on it.
    expect(addItemsToGroceryListMock).toHaveBeenCalledWith(["ground beef"]);
    expect(screen.queryByDisplayValue("ground beef")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    resolveAdd({ error: "Couldn't add those items." });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't add those items."),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("lets an ingredient be edited or removed before adding to the grocery list", async () => {
    parseMealIngredientsMock.mockResolvedValue({ data: ["ground beef", "taco shells"] });
    addItemsToGroceryListMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    const entries = withEntry(emptyWeek(), { dayOfWeek: "Monday", mealSlot: "dinner", content: "Tacos" });
    render(<MealPlanSection initialWeekStartDate={CURRENT_WEEK_START} initialEntries={entries} />);

    await user.click(within(slot("Monday", "dinner")).getByRole("button", { name: "Add ingredients to grocery list" }));
    await screen.findByDisplayValue("ground beef");

    await user.click(screen.getAllByRole("button", { name: "Remove ingredient" })[1]);
    expect(screen.queryByDisplayValue("taco shells")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add to Grocery List" }));
    expect(addItemsToGroceryListMock).toHaveBeenCalledWith(["ground beef"]);
  });
});
