"use client";

import { useState } from "react";
import type { CalendarEvent } from "@/lib/google-calendar-utils";
import {
  formatEventDate,
  formatEventTime,
  isSameLocalDay,
  parseEventDate,
} from "@/lib/google-calendar-utils";
import { useHasMounted } from "@/lib/use-has-mounted";

const TABS = ["today", "tomorrow", "upcoming"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = { today: "Today", tomorrow: "Tomorrow", upcoming: "Upcoming" };

export function EventsCardBody({ events }: { events: CalendarEvent[] }) {
  const mounted = useHasMounted();
  const [tab, setTab] = useState<Tab>("today");

  if (events.length === 0) {
    return <p className="text-sm text-zinc-400 dark:text-zinc-500">No upcoming events.</p>;
  }

  // Grouping depends on the device's local "today", which a Server Component
  // can't know — wait until mount rather than risk grouping events using the
  // server's (often UTC) clock during the very first render.
  if (!mounted) {
    return <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading…</p>;
  }

  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const todayEvents: CalendarEvent[] = [];
  const tomorrowEvents: CalendarEvent[] = [];
  const upcomingEvents: CalendarEvent[] = [];

  for (const event of events) {
    const eventDate = parseEventDate(event);
    if (isSameLocalDay(eventDate, now)) {
      todayEvents.push(event);
    } else if (isSameLocalDay(eventDate, tomorrow)) {
      tomorrowEvents.push(event);
    } else {
      upcomingEvents.push(event);
    }
  }

  const visibleEvents =
    tab === "today" ? todayEvents : tab === "tomorrow" ? tomorrowEvents : upcomingEvents;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "border-b-2 border-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-b-2 border-transparent px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            }
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {visibleEvents.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          {tab === "today"
            ? "No events today."
            : tab === "tomorrow"
              ? "No events tomorrow."
              : "No upcoming events."}
        </p>
      ) : (
        <ul className="flex max-h-60 flex-col gap-3 overflow-y-auto">
          {visibleEvents.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className="w-28 shrink-0 font-medium text-zinc-500 dark:text-zinc-400">
                {tab === "today"
                  ? formatEventTime(event)
                  : `${formatEventDate(event)}${
                      !event.isAllDay ? `, ${formatEventTime(event)}` : ""
                    }`}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">{event.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
