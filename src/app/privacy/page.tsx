export const metadata = {
  title: "Privacy Policy — Life Dashboard",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-zinc-800 dark:text-zinc-200">
      <h1 className="mb-2 text-xl font-bold">Privacy Policy for Life Dashboard</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">Last updated: August 2026</p>

      <p className="mb-4">
        Life Dashboard is a personal application built and used exclusively by its owner. It is
        not distributed publicly and does not have external users.
      </p>

      <p className="mb-4">
        This application connects to third-party services (including Google Calendar, Todoist,
        and Whoop) solely to display the owner&apos;s own personal data within a private
        dashboard. Data retrieved from these services is stored securely and is used only for the
        owner&apos;s personal reference. It is never sold, shared, or provided to any third party.
      </p>

      <p className="mb-4">
        Access to this application is restricted to a single authenticated account. No data
        collected through this application is used for advertising, analytics, or any purpose
        beyond the owner&apos;s personal use.
      </p>

      <p>
        For questions, contact:{" "}
        <a href="mailto:b22floyd@gmail.com" className="underline">
          b22floyd@gmail.com
        </a>
      </p>
    </div>
  );
}
