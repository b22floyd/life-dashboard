import { describe, expect, it } from "vitest";
import { searchItems, truncateForLabel, type SearchItem } from "./search-utils";

function item(overrides: Partial<SearchItem>): SearchItem {
  return { id: "1", category: "Test", label: "", sectionId: "test-section", ...overrides };
}

describe("searchItems", () => {
  it("returns nothing for an empty or whitespace-only query", () => {
    const items = [item({ label: "Buy milk" })];
    expect(searchItems(items, "")).toEqual([]);
    expect(searchItems(items, "   ")).toEqual([]);
  });

  it("matches case-insensitively against label", () => {
    const items = [item({ id: "1", label: "Buy Milk" })];
    expect(searchItems(items, "milk")).toHaveLength(1);
    expect(searchItems(items, "MILK")).toHaveLength(1);
    expect(searchItems(items, "bread")).toHaveLength(0);
  });

  it("matches against secondary text too", () => {
    const items = [item({ id: "1", label: "Sarah", secondary: "loves hiking and pottery" })];
    expect(searchItems(items, "hiking")).toHaveLength(1);
  });

  it("ranks a label match above a secondary-only match", () => {
    const items = [
      item({ id: "secondary-only", label: "Contact A", secondary: "mentioned coffee once" }),
      item({ id: "label-match", label: "Coffee Shop Recs", secondary: "" }),
    ];
    const results = searchItems(items, "coffee");
    expect(results.map((r) => r.id)).toEqual(["label-match", "secondary-only"]);
  });

  it("preserves original relative order within the same rank", () => {
    const items = [
      item({ id: "a", label: "apple pie" }),
      item({ id: "b", label: "apple tart" }),
      item({ id: "c", label: "apple crumble" }),
    ];
    expect(searchItems(items, "apple").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("does not match a field that is undefined", () => {
    const items = [item({ id: "1", label: "Something", secondary: undefined })];
    expect(searchItems(items, "nonexistent")).toEqual([]);
  });

  it("matches a substring in the middle of a word", () => {
    const items = [item({ label: "Overhead Press" })];
    expect(searchItems(items, "head")).toHaveLength(1);
  });
});

describe("truncateForLabel", () => {
  it("returns short text unchanged", () => {
    expect(truncateForLabel("Short entry")).toBe("Short entry");
  });

  it("trims surrounding whitespace even when under the limit", () => {
    expect(truncateForLabel("  padded  ")).toBe("padded");
  });

  it("truncates long text and appends an ellipsis", () => {
    const long = "a".repeat(100);
    const result = truncateForLabel(long, 80);
    expect(result.length).toBe(81); // 80 chars + the ellipsis character
    expect(result.endsWith("…")).toBe(true);
  });

  it("does not cut off mid-word by leaving trailing whitespace before the ellipsis", () => {
    const text = `${"word ".repeat(20)}tail`;
    const result = truncateForLabel(text, 20);
    expect(result).not.toMatch(/\s…$/);
  });
});
