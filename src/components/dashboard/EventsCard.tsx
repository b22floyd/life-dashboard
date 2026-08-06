import { disconnectGoogleCalendar } from "@/app/actions/google-calendar";
import { getUpcomingEvents, isGoogleCalendarConnected } from "@/lib/google-calendar";
import { EventsCardBody } from "./EventsCardBody";
import { SectionLoadError } from "./SectionLoadError";
import { WidgetCard } from "./WidgetCard";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Access to Google Calendar was denied.",
  invalid_state: "That Google sign-in expired or was tampered with — try connecting again.",
  token_exchange_failed: "Google didn't accept that authorization — try connecting again.",
  missing_refresh_token:
    "Google didn't grant offline access. Remove Life Dashboard's access at myaccount.google.com/permissions and try connecting again.",
  storage_failed: "Connected, but saving the connection failed — try again.",
};

export async function EventsCard({
  error,
  errorDetail,
}: {
  error?: string;
  errorDetail?: string;
}) {
  const connected = await isGoogleCalendarConnected();
  const events = connected ? await getUpcomingEvents() : null;

  return (
    <WidgetCard
      title="Upcoming Events"
      id="events-section"
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
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">
          <p>{GOOGLE_ERROR_MESSAGES[error] ?? "Something went wrong connecting Google Calendar."}</p>
          {errorDetail && <p className="mt-1 font-mono text-xs opacity-80">{errorDetail}</p>}
        </div>
      )}

      {!connected ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Connect your Google Calendar to see upcoming events here.
          </p>
          <a
            href="/api/auth/google"
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Connect Google Calendar
          </a>
        </div>
      ) : events === null ? (
        <SectionLoadError message="Couldn't load events from Google Calendar. If this keeps happening, try disconnecting and reconnecting." />
      ) : (
        <EventsCardBody events={events} />
      )}
    </WidgetCard>
  );
}
