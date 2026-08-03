import { disconnectWhoop } from "@/app/actions/whoop";
import { getHealthSnapshot, getRecoveryTrend, isWhoopConnected } from "@/lib/whoop";
import { formatSleepDuration, recoveryColorClass } from "@/lib/whoop-utils";
import { WidgetCard } from "./WidgetCard";
import { RecoveryTrendChart } from "./RecoveryTrendChart";

const WHOOP_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Access to Whoop was denied.",
  invalid_state: "That Whoop sign-in expired or was tampered with — try connecting again.",
  token_exchange_failed: "Whoop didn't accept that authorization — try connecting again.",
  missing_refresh_token:
    "Whoop didn't grant offline access — try connecting again.",
  storage_failed: "Connected, but saving the connection failed — try again.",
};

function formatAsOf(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

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
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
              As of {formatAsOf(snapshot.asOf)}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800/60">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Recovery</p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    snapshot.recoveryScore !== null
                      ? recoveryColorClass(snapshot.recoveryScore)
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {snapshot.recoveryScore !== null ? `${snapshot.recoveryScore}%` : "—"}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800/60">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sleep</p>
                <p className="mt-1 text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                  {snapshot.sleepDurationMs !== null
                    ? formatSleepDuration(snapshot.sleepDurationMs)
                    : "—"}
                </p>
                {snapshot.sleepPerformancePercentage !== null && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {Math.round(snapshot.sleepPerformancePercentage)}% of need
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800/60">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Strain</p>
                <p className="mt-1 text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                  {snapshot.strain !== null ? snapshot.strain.toFixed(1) : "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <RecoveryTrendChart data={trend} />
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
