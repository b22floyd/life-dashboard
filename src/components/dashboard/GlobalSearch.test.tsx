// @vitest-environment jsdom
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "./GlobalSearch";
import type { SearchItem } from "@/lib/search-utils";

const items: SearchItem[] = [
  { id: "1", label: "Morning run", category: "Habits", sectionId: "habits-section" },
  { id: "2", label: "Evening walk", category: "Habits", sectionId: "habits-section" },
  { id: "3", label: "Bench press PR", category: "Weight Training", sectionId: "workout-section" },
];

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView — selectResult() calls it, so a
  // real click/Enter on a result would otherwise throw "not implemented".
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("GlobalSearch", () => {
  it("renders a closed trigger button with no dialog visible", () => {
    render(<GlobalSearch items={items} />);
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the dialog on click and focuses the input", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch items={items} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search tasks/i)).toHaveFocus();
  });

  it("opens the dialog from anywhere via Cmd+K", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch items={items} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a prompt before typing and filters results grouped by category as you type", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch items={items} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(screen.getByText(/type to search/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search tasks/i), "run");
    expect(screen.getByRole("button", { name: "Morning run" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Evening walk" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bench press PR" })).not.toBeInTheDocument();
  });

  it("shows a no-matches message for a query with no results", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch items={items} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    await user.type(screen.getByPlaceholderText(/search tasks/i), "zzzznomatch");
    expect(screen.getByText(/no matches for/i)).toBeInTheDocument();
  });

  it("groups multiple matches under their category heading", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch items={items} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    // Empty query matches everything via searchItems, exercising real grouping.
    const dialog = screen.getByRole("dialog");
    await user.type(screen.getByPlaceholderText(/search tasks/i), "e");
    expect(within(dialog).getByText("Habits")).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger button", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch items={items} />);
    const trigger = screen.getByRole("button", { name: /search/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("selecting a result via Enter scrolls to its section and closes the dialog", async () => {
    const user = userEvent.setup();
    // selectResult() looks up the target section by id in the real DOM
    // (document.getElementById) — without a matching element present,
    // scrollIntoView is silently never called, same as it would be if the
    // dashboard hadn't actually rendered that section.
    document.body.innerHTML += '<div id="workout-section"></div>';
    render(<GlobalSearch items={items} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    await user.type(screen.getByPlaceholderText(/search tasks/i), "bench");
    await user.keyboard("{Enter}");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicking a result also selects it", async () => {
    const user = userEvent.setup();
    document.body.innerHTML += '<div id="habits-section"></div>';
    render(<GlobalSearch items={items} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    await user.type(screen.getByPlaceholderText(/search tasks/i), "run");
    await user.click(screen.getByRole("button", { name: "Morning run" }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Tab from the last focusable element wraps back to the input (focus trap)", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch items={items} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    const input = screen.getByPlaceholderText(/search tasks/i);
    await user.type(input, "run");

    const results = screen.getAllByRole("button", { name: /run|walk/i });
    const lastResult = results[results.length - 1];
    lastResult.focus();
    expect(lastResult).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();
  });

  it("Shift+Tab from the input wraps to the last focusable element (focus trap)", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch items={items} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    const input = screen.getByPlaceholderText(/search tasks/i);
    await user.type(input, "run");
    input.focus();
    expect(input).toHaveFocus();

    await user.tab({ shift: true });
    const results = screen.getAllByRole("button", { name: /run|walk/i });
    expect(results[results.length - 1]).toHaveFocus();
  });
});
