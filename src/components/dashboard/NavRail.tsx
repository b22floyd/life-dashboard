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

// Slim by default (dots only, hugging the left edge so it doesn't sit over
// card content at typical desktop widths) — expands to show text labels on
// hover/focus, an auto-hide dock pattern (VS Code activity bar, macOS Dock)
// that only overlaps page content transiently while the cursor is right at
// that screen edge. The current section's label stays visible even when
// collapsed, so there's always an at-a-glance answer to "where am I".
function DesktopRail({ activeId }: { activeId: string | null }) {
  return (
    <nav
      aria-label="Jump to section"
      className="fixed top-1/2 left-0 z-30 hidden -translate-y-1/2 lg:block"
    >
      <ul className="group flex flex-col gap-0.5 rounded-r-xl border border-l-0 border-zinc-200 bg-white/90 py-3 pr-3 pl-2 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        {NAV_SECTIONS.map((section) => {
          const isActive = section.id === activeId;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => scrollToSection(section.id)}
                aria-current={isActive ? "true" : undefined}
                title={section.label}
                className="flex items-center gap-2 rounded-full py-1 pr-1 text-left"
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                    isActive
                      ? "bg-zinc-900 dark:bg-zinc-100"
                      : "bg-zinc-300 group-hover:bg-zinc-400 dark:bg-zinc-700 dark:group-hover:bg-zinc-600"
                  }`}
                />
                <span
                  className={`overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "max-w-[10rem] text-zinc-900 opacity-100 dark:text-zinc-100"
                      : "max-w-0 text-zinc-500 opacity-0 group-hover:max-w-[10rem] group-hover:opacity-100 group-focus-within:max-w-[10rem] group-focus-within:opacity-100 dark:text-zinc-400"
                  }`}
                >
                  {section.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Mirrors DailyGlancePanel's click-to-open / click-outside-to-close pattern.
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
    <div ref={containerRef} className="fixed right-5 bottom-5 z-30 lg:hidden">
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
