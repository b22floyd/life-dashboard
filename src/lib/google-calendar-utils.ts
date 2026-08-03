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
