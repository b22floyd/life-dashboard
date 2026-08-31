"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchItems, type SearchItem } from "@/lib/search-utils";

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Groups matches by category, preserving searchItems' own rank-then-original
// order within each group and the order categories first appear in — so
// results read as a stable, predictable list rather than reshuffling
// unpredictably as the query changes.
function groupByCategory(items: SearchItem[]): { category: string; items: SearchItem[] }[] {
  const groups: { category: string; items: SearchItem[] }[] = [];
  const indexByCategory = new Map<string, number>();

  for (const item of items) {
    const existingIndex = indexByCategory.get(item.category);
    if (existingIndex === undefined) {
      indexByCategory.set(item.category, groups.length);
      groups.push({ category: item.category, items: [item] });
    } else {
      groups[existingIndex].items.push(item);
    }
  }

  return groups;
}

export function GlobalSearch({ items }: { items: SearchItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchItems(items, query), [items, query]);
  const groups = useMemo(() => groupByCategory(results), [results]);

  function open() {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(0);
  }

  function close() {
    setIsOpen(false);
  }

  function selectResult(item: SearchItem) {
    scrollToSection(item.sectionId);
    close();
  }

  // Cmd/Ctrl+K opens search from anywhere on the dashboard, matching the
  // convention established by every command-palette-style search (Slack,
  // Linear, GitHub, ...) — the one keyboard shortcut a dashboard user is
  // likely to already know rather than needing to discover from scratch.
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Reset keyboard selection back to the top result whenever the visible
  // result set changes, so arrowing down in a stale list never lands on
  // something that's since scrolled out of view. Adjusted during render
  // (React's "adjusting state when a prop changes" pattern) rather than in
  // an effect — results is a stable reference from useMemo, so this only
  // actually resets when items/query genuinely change, not on every render.
  const [handledResults, setHandledResults] = useState(results);
  if (results !== handledResults) {
    setHandledResults(results);
    setActiveIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      selectResult(results[activeIndex]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <span aria-hidden>🔍</span>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-zinc-300 px-1 text-[10px] text-zinc-400 sm:inline dark:border-zinc-700 dark:text-zinc-500">
          ⌘K
        </kbd>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search the dashboard"
            className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-zinc-900"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks, contacts, goals, journal…"
              className="w-full border-b border-zinc-200 px-4 py-3 text-sm text-zinc-800 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            />

            <div className="flex-1 overflow-y-auto p-2">
              {query.trim() === "" ? (
                <p className="p-3 text-sm text-zinc-400 dark:text-zinc-500">
                  Type to search across your dashboard.
                </p>
              ) : results.length === 0 ? (
                <p className="p-3 text-sm text-zinc-400 dark:text-zinc-500">
                  No matches for &quot;{query}&quot;.
                </p>
              ) : (
                (() => {
                  // Flattened once here so keyboard nav (activeIndex) can
                  // index straight into the same order the groups render in,
                  // without recomputing a running offset inside the JSX.
                  let runningIndex = -1;
                  return groups.map((group) => (
                    <div key={group.category} className="mb-2">
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {group.category}
                      </p>
                      {group.items.map((item) => {
                        runningIndex += 1;
                        const isActive = runningIndex === activeIndex;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectResult(item)}
                            onMouseEnter={() => setActiveIndex(runningIndex)}
                            className={
                              isActive
                                ? "block w-full truncate rounded-lg bg-zinc-100 px-2 py-1.5 text-left text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                                : "block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                            }
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
