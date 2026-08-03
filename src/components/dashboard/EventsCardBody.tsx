"use client";

import type { CalendarEvent } from "@/lib/google-calendar-utils";
import {
  formatEventDate,
  formatEventTime,
  isSameLocalDay,
  parseEventDate,
} from "@/lib/google-calendar-utils";
import { useHasMounted } from "@/lib/use-has-mounted";

export function EventsCardBody({ events }: { events: CalendarEvent[] }) {
  const mounted = useHasMounted();

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
  const todayEvents: CalendarEvent[] = [];
  const upcomingEvents: CalendarEvent[] = [];

  for (const event of events) {
    if (isSameLocalDay(parseEventDate(event), now)) {
      todayEvents.push(event);
    } else {
      upcomingEvents.push(event);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {todayEvents.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Today
          </h3>
          <ul className="flex max-h-60 flex-col gap-3 overflow-y-auto">
            {todayEvents.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="w-20 shrink-0 font-medium text-zinc-500 dark:text-zinc-400">
                  {formatEventTime(event)}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">{event.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Upcoming
          </h3>
          <ul className="flex max-h-60 flex-col gap-3 overflow-y-auto">
            {upcomingEvents.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="w-28 shrink-0 font-medium text-zinc-500 dark:text-zinc-400">
                  {formatEventDate(event)}
                  {!event.isAllDay && `, ${formatEventTime(event)}`}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">{event.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
