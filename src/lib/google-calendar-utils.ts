export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO datetime for timed events, "yyyy-mm-dd" for all-day
  isAllDay: boolean;
};

// `new Date("yyyy-mm-dd")` parses date-only strings as UTC midnight, which
// rolls back a day in negative-offset local timezones — construct an
// explicit local date for all-day events instead of handing the raw string
// straight to `Date`.
export function parseEventDate(event: CalendarEvent): Date {
  if (event.isAllDay) {
    const [year, month, day] = event.start.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(event.start);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return "All day";
  return new Date(event.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatEventDate(event: CalendarEvent): string {
  return parseEventDate(event).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// An event starting within the hour (or that started up to 30 minutes ago,
// likely still in progress) needs attention now, unlike one later today —
// all-day events have no specific start time to be "soon" about.
export function isEventStartingSoon(
  event: CalendarEvent,
  now: Date,
  windowMinutes = 60,
): boolean {
  if (event.isAllDay) return false;
  const diffMinutes = (new Date(event.start).getTime() - now.getTime()) / 60_000;
  return diffMinutes <= windowMinutes && diffMinutes > -30;
}
