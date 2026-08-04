"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyGlanceData } from "@/lib/daily-glance";
import { categorizeDueToday, isTodoistTaskDueTodayOrOverdue } from "@/lib/daily-glance-utils";
import { getLocalDateString } from "@/lib/date-utils";
import { formatEventTime, isSameLocalDay, parseEventDate } from "@/lib/google-calendar-utils";
import {
  DAYS_OF_WEEK,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  type MealPlanEntry,
  type MealSlot,
} from "@/lib/meal-plan-utils";
import { useHasMounted } from "@/lib/use-has-mounted";
import { formatSleepDuration } from "@/lib/whoop-utils";

// Section ids match the id= given to each corresponding WidgetCard, so
// clicking an item can scroll straight to it.
const SECTION_IDS = {
  habits: "habits-section",
  workTasks: "work-tasks-section",
  personalTasks: "personal-tasks-section",
  events: "events-section",
  cleaning: "cleaning-section",
  contacts: "contacts-section",
  mealPlan: "meal-plan-section",
  health: "health-section",
} as const;

type GlanceItem = { id: string; label: string; sectionId: string };

function describeMealSlot(entry: MealPlanEntry | undefined, slot: MealSlot): string {
  const label = MEAL_SLOT_LABELS[slot];
  if (!entry) return `${label}: Not planned yet`;
  if (entry.mode === "eating_out") return `${label}: Eating Out`;
  if (entry.mode === "leftovers") {
    return entry.leftoverDayOfWeek && entry.leftoverMealSlot
      ? `${label}: Leftovers (${entry.leftoverDayOfWeek} ${MEAL_SLOT_LABELS[entry.leftoverMealSlot]})`
      : `${label}: Leftovers`;
  }
  return `${label}: ${entry.content || "Not planned yet"}`;
}

function GlanceSection({
  title,
  items,
  emptyMessage,
  onItemClick,
}: {
  title: string;
  items: GlanceItem[];
  emptyMessage: string;
  onItemClick: (sectionId: string) => void;
}) {
  return (
    <div className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0 dark:border-zinc-800">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onItemClick(item.sectionId)}
                className="text-left text-sm text-zinc-700 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GlanceContent({
  data,
  onItemClick,
}: {
  data: DailyGlanceData;
  onItemClick: (sectionId: string) => void;
}) {
  const now = new Date();
  const today = getLocalDateString(now);

  const habitsDueToday: GlanceItem[] = data.habits
    .filter((habit) => !habit.completedDates.includes(today))
    .map((habit) => ({ id: habit.id, label: habit.name, sectionId: SECTION_IDS.habits }));

  // Personal Tasks have no due date of their own (just a flat running
  // list), so — unlike Work Tasks — every outstanding one counts as
  // "today's" here; there's no other date to filter them by.
  const workTasksToday: GlanceItem[] = (data.workTasks ?? [])
    .filter((task) => task.dueDate && isTodoistTaskDueTodayOrOverdue(task.dueDate, today))
    .map((task) => ({
      id: `work-${task.id}`,
      label: task.content,
      sectionId: SECTION_IDS.workTasks,
    }));
  const personalTasksToday: GlanceItem[] = data.personalTasks.map((task) => ({
    id: `personal-${task.id}`,
    label: task.content,
    sectionId: SECTION_IDS.personalTasks,
  }));
  const tasksToday = [...workTasksToday, ...personalTasksToday];

  const eventsToday: GlanceItem[] = (data.events ?? [])
    .filter((event) => isSameLocalDay(parseEventDate(event), now))
    .map((event) => ({
      id: event.id,
      label: `${formatEventTime(event)} — ${event.title}`,
      sectionId: SECTION_IDS.events,
    }));

  const cleaningDue: GlanceItem[] = data.cleaningTasks
    .filter((task) => task.isDue)
    .map((task) => {
      const status = categorizeDueToday(task.nextDueAt, today);
      return {
        id: task.id,
        label: status === "overdue" ? `${task.name} - overdue` : `${task.name} - due today`,
        sectionId: SECTION_IDS.cleaning,
      };
    });

  const contactsDue: GlanceItem[] = data.contacts
    .filter((contact) => contact.isDue)
    .map((contact) => {
      const status = categorizeDueToday(contact.nextDueAt, today);
      return {
        id: contact.id,
        label: status === "overdue" ? `${contact.name} - overdue` : `${contact.name} - due today`,
        sectionId: SECTION_IDS.contacts,
      };
    });

  const todayDayOfWeek = DAYS_OF_WEEK[now.getDay()];
  const todaysMealEntries = data.mealPlanEntries.filter(
    (entry) => entry.dayOfWeek === todayDayOfWeek,
  );
  const mealPlanLines: GlanceItem[] = MEAL_SLOTS.map((slot) => ({
    id: slot,
    label: describeMealSlot(
      todaysMealEntries.find((entry) => entry.mealSlot === slot),
      slot,
    ),
    sectionId: SECTION_IDS.mealPlan,
  }));

  const healthLines: GlanceItem[] = [];
  if (data.healthSnapshot) {
    const snapshot = data.healthSnapshot;
    const parts: string[] = [];
    if (snapshot.recoveryScore !== null) parts.push(`Recovery ${snapshot.recoveryScore}%`);
    if (snapshot.sleepDurationMs !== null) {
      parts.push(`Sleep ${formatSleepDuration(snapshot.sleepDurationMs)}`);
    }
    if (snapshot.strain !== null) parts.push(`Strain ${snapshot.strain.toFixed(1)}`);
    healthLines.push({
      id: "whoop",
      label: parts.length > 0 ? parts.join(" · ") : "No scored Whoop data yet.",
      sectionId: SECTION_IDS.health,
    });
  } else {
    healthLines.push({ id: "whoop", label: "Whoop not connected.", sectionId: SECTION_IDS.health });
  }

  const latestWeight = data.weightEntries[data.weightEntries.length - 1] ?? null;
  if (latestWeight && data.weightGoal) {
    healthLines.push({
      id: "weight",
      label: `Weight ${latestWeight.weight} lb (goal ${data.weightGoal.goalWeight} lb)`,
      sectionId: SECTION_IDS.health,
    });
  } else if (latestWeight) {
    healthLines.push({
      id: "weight",
      label: `Weight ${latestWeight.weight} lb (no goal set)`,
      sectionId: SECTION_IDS.health,
    });
  } else {
    healthLines.push({ id: "weight", label: "No weight logged yet.", sectionId: SECTION_IDS.health });
  }

  return (
    <div className="flex flex-col gap-3">
      <GlanceSection
        title="Habits"
        items={habitsDueToday}
        emptyMessage="All habits done for today."
        onItemClick={onItemClick}
      />
      <GlanceSection
        title="Tasks"
        items={tasksToday}
        emptyMessage="Nothing due today."
        onItemClick={onItemClick}
      />
      <GlanceSection
        title="Events"
        items={eventsToday}
        emptyMessage="No events today."
        onItemClick={onItemClick}
      />
      <GlanceSection
        title="Cleaning"
        items={cleaningDue}
        emptyMessage="Nothing due or overdue."
        onItemClick={onItemClick}
      />
      <GlanceSection
        title="Contacts"
        items={contactsDue}
        emptyMessage="Nobody due for a reach-out."
        onItemClick={onItemClick}
      />
      <GlanceSection title="Meal Plan" items={mealPlanLines} emptyMessage="" onItemClick={onItemClick} />
      <GlanceSection title="Health" items={healthLines} emptyMessage="" onItemClick={onItemClick} />
    </div>
  );
}

export function DailyGlancePanel({ data }: { data: DailyGlanceData }) {
  const mounted = useHasMounted();
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

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <span aria-hidden>📋</span>
        <span>Today at a Glance</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 max-h-[32rem] w-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {!mounted ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading…</p>
          ) : (
            <GlanceContent data={data} onItemClick={scrollToSection} />
          )}
        </div>
      )}
    </div>
  );
}
