"use client";

import type { HealthSnapshot, RecoveryPoint } from "@/lib/whoop-utils";
import { formatSleepDuration, recoveryColorClass } from "@/lib/whoop-utils";
import { useHasMounted } from "@/lib/use-has-mounted";
import { RecoveryTrendChart } from "./RecoveryTrendChart";

// HealthCard is a Server Component, so formatting this here (rather than
// server-side) avoids using the server's (often UTC) timezone for the date.
function formatAsOf(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function HealthCardBody({
  snapshot,
  trend,
}: {
  snapshot: HealthSnapshot;
  trend: RecoveryPoint[];
}) {
  const mounted = useHasMounted();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
          {mounted ? `As of ${formatAsOf(snapshot.asOf)}` : " "}
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
  );
}
