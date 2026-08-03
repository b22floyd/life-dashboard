import { disconnectWhoop } from "@/app/actions/whoop";
import { getHealthSnapshot, getRecoveryTrend, isWhoopConnected } from "@/lib/whoop";
import { getWeightEntries, getWeightGoal } from "@/lib/weight";
import { HealthCardBody } from "./HealthCardBody";
import { WeightTrackerSection } from "./WeightTrackerSection";
import { WidgetCard } from "./WidgetCard";

const WHOOP_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Access to Whoop was denied.",
  invalid_state: "That Whoop sign-in expired or was tampered with — try connecting again.",
  token_exchange_failed: "Whoop didn't accept that authorization — try connecting again.",
  missing_refresh_token:
    "Whoop didn't grant offline access — try connecting again.",
  storage_failed: "Connected, but saving the connection failed — try again.",
};

export async function HealthCard({
  error,
  errorDetail,
}: {
  error?: string;
  errorDetail?: string;
}) {
  const connected = await isWhoopConnected();
  const [snapshot, trend] = connected
    ? await Promise.all([getHealthSnapshot(), getRecoveryTrend()])
    : [null, []];
  const [weightEntries, weightGoal] = await Promise.all([getWeightEntries(), getWeightGoal()]);

  return (
    <WidgetCard
      title="Health"
      className="lg:col-span-3"
      action={
        connected ? (
          <form action={disconnectWhoop}>
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
          <p>{WHOOP_ERROR_MESSAGES[error] ?? "Something went wrong connecting Whoop."}</p>
          {errorDetail && <p className="mt-1 font-mono text-xs opacity-80">{errorDetail}</p>}
        </div>
      )}

      {!connected ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Connect Whoop to see your recovery, sleep, and strain here.
          </p>
          <a
            href="/api/auth/whoop"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Connect Whoop
          </a>
        </div>
      ) : snapshot === null ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load data from Whoop. Try disconnecting and reconnecting.
        </p>
      ) : (
        <HealthCardBody snapshot={snapshot} trend={trend} />
      )}

      {/* Weight Tracker is independent of the Whoop connection above — it's
          the user's own logged data, not something Whoop provides. */}
      <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <WeightTrackerSection entries={weightEntries} goal={weightGoal} />
      </div>
    </WidgetCard>
  );
}
