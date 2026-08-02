import { disconnectGoogleCalendar } from "@/app/actions/google-calendar";
import {
  getUpcomingEvents,
  isGoogleCalendarConnected,
  type CalendarEvent,
} from "@/lib/google-calendar";
import { WidgetCard } from "./WidgetCard";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Access to Google Calendar was denied.",
  invalid_state: "That Google sign-in expired or was tampered with — try connecting again.",
  token_exchange_failed: "Google didn't accept that authorization — try connecting again.",
  missing_refresh_token:
    "Google didn't grant offline access. Remove Life Dashboard's access at myaccount.google.com/permissions and try connecting again.",
  storage_failed: "Connected, but saving the connection failed — try again.",
};

function formatEventTime(event: CalendarEvent) {
  if (event.isAllDay) return "All day";
  return new Date(event.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function EventsCard({ error }: { error?: string }) {
  const connected = await isGoogleCalendarConnected();
  const events = connected ? await getUpcomingEvents() : null;

  return (
    <WidgetCard
      title="Upcoming Events"
      action={
        connected ? (
          <form action={disconnectGoogleCalendar}>
            <button
              type="submit"
              className="text-xs font-medium text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
            >
              Disconnect
            </button>
          </form>
        ) : undefined
      }
    >
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">
          {GOOGLE_ERROR_MESSAGES[error] ?? "Something went wrong connecting Google Calendar."}
        </p>
      )}

      {!connected ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Connect your Google Calendar to see upcoming events here.
          </p>
          <a
            href="/api/auth/google"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Connect Google Calendar
          </a>
        </div>
      ) : events === null ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load events from Google Calendar. Try disconnecting and reconnecting.
        </p>
      ) : events.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No upcoming events.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className="w-20 shrink-0 font-medium text-zinc-500 dark:text-zinc-400">
                {formatEventTime(event)}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">{event.title}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
