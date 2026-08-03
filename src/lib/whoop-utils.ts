export type RecoveryPoint = {
  date: string; // yyyy-mm-dd
  recoveryScore: number;
};

export type HealthSnapshot = {
  recoveryScore: number | null; // percentage 0-100
  restingHeartRate: number | null;
  hrvMilli: number | null;
  sleepDurationMs: number | null; // time asleep (excludes awake/no-data time)
  sleepPerformancePercentage: number | null;
  strain: number | null; // 0-21
  asOf: string; // ISO timestamp of the most recent recovery/cycle/sleep record
};

export function formatSleepDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// Mirrors Whoop's own recovery color bands (green/yellow/red).
export function recoveryColorClass(score: number): string {
  if (score >= 67) return "text-green-600 dark:text-green-400";
  if (score >= 34) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}
