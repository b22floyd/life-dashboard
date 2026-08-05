"use client";

import { useEffect, useRef, useState } from "react";
import { useActiveSection } from "@/lib/use-active-section";

// Order matches the dashboard's own top-to-bottom card layout in page.tsx.
const NAV_SECTIONS = [
  { id: "personal-tasks-section", label: "Personal Tasks" },
  { id: "work-tasks-section", label: "Work Tasks" },
  { id: "events-section", label: "Upcoming Events" },
  { id: "habits-section", label: "Habit Streaks" },
  { id: "annual-goals-section", label: "Annual Goals" },
  { id: "cleaning-section", label: "Cleaning Reminders" },
  { id: "contacts-section", label: "Contacts" },
  { id: "meal-plan-section", label: "Meal Plan" },
  { id: "monarch-section", label: "Monarch" },
  { id: "journal-section", label: "Journal" },
  { id: "health-section", label: "Health" },
  { id: "workout-section", label: "Weight Training" },
] as const;

const NAV_SECTION_IDS = NAV_SECTIONS.map((section) => section.id);

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function NavRail() {
  const activeId = useActiveSection(NAV_SECTION_IDS);

  return (
    <>
      <DesktopRail activeId={activeId} />
      <MobileNav activeId={activeId} />
    </>
  );
}

// Only rendered at `xl:` (1280px) and up, and positioned relative to the
// viewport's horizontal center rather than pinned to `left-0` — at exactly
// 1280px wide, the page's own `max-w-6xl` (72rem) content column already
// leaves only ~64px of true margin outside itself, so a rail pinned to the
// literal viewport edge (or one that grows wider on hover) would sit on top
// of card content rather than beside it. `left-[calc(50%-39rem)]` places the
// rail's own ~2rem-wide dot column with a fixed 1rem gap before the content
// column's left edge (36rem out from center) — that gap holds at every width
// from 1280px up, since both the rail and the content shift together with
// the viewport's center. No hover-to-expand state and no background/border
// box around the dots — just the dots themselves, so there's nothing to
// visually overlap or compete with the cards next to it. Labels are native
// `title` tooltips plus an `aria-label`, not a custom overlay.
function DesktopRail({ activeId }: { activeId: string | null }) {
  return (
    <nav
      aria-label="Jump to section"
      className="fixed top-1/2 left-[calc(50%-39rem)] z-30 hidden -translate-y-1/2 xl:block"
    >
      <ul className="flex flex-col gap-3">
        {NAV_SECTIONS.map((section) => {
          const isActive = section.id === activeId;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => scrollToSection(section.id)}
                aria-current={isActive ? "true" : undefined}
                aria-label={section.label}
                title={section.label}
                className="group block p-1.5"
              >
                <span
                  aria-hidden
                  className={`block h-2 w-2 rounded-full transition-colors ${
                    isActive
                      ? "bg-zinc-900 dark:bg-zinc-100"
                      : "bg-zinc-300 group-hover:bg-zinc-500 dark:bg-zinc-700 dark:group-hover:bg-zinc-400"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Mirrors DailyGlancePanel's click-to-open / click-outside-to-close pattern.
// Covers every width below DesktopRail's `xl:` cutoff (not just phones) —
// including the 1024-1279px band where the page's content column leaves no
// safe margin for a persistent side rail, a floating button is the only
// option that can't overlap a card.
function MobileNav({ activeId }: { activeId: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleItemClick(id: string) {
    scrollToSection(id);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="fixed right-5 bottom-5 z-30 xl:hidden">
      {isOpen && (
        <ul className="absolute right-0 bottom-14 mb-2 max-h-[70vh] w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {NAV_SECTIONS.map((section) => {
            const isActive = section.id === activeId;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => handleItemClick(section.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    isActive
                      ? "font-medium text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {section.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label="Jump to section"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        <span aria-hidden className="text-lg">
          {isOpen ? "✕" : "☰"}
        </span>
      </button>
    </div>
  );
}
