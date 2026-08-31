import Link from "next/link";
import { DataRestorePanel } from "@/components/dashboard/DataRestorePanel";
import { NotificationSettings } from "@/components/dashboard/NotificationSettings";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/"
        className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Settings
      </h1>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Notifications
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Get a daily reminder if any habits are still outstanding, a cleaning task is due, or a
          contact is due for a reach-out. Sent once a day at a fixed time — not tied to when you
          actually open the app.
        </p>
        <div className="mt-3">
          <NotificationSettings />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Export
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Download everything in this dashboard as a single JSON file. The same file this
          downloads is also what the weekly automated backup saves.
        </p>
        <a
          href="/api/export"
          className="mt-3 inline-block rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Export My Data
        </a>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Restore
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Upload a backup file to restore one or more sections. Restoring a section replaces its
          current data with the backup&apos;s — pick sections individually so you only touch what
          you actually need to.
        </p>
        <div className="mt-3">
          <DataRestorePanel />
        </div>
      </section>
    </div>
  );
}
