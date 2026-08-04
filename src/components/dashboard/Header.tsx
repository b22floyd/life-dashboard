import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { getWeatherSnapshot } from "@/lib/weather";
import { DailyGlance } from "./DailyGlance";
import { HeaderDate } from "./HeaderDate";
import { WeatherWidget } from "./WeatherWidget";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const weatherSnapshot = await getWeatherSnapshot();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Life Dashboard
          </h1>
          <HeaderDate />
        </div>
        <div className="flex items-center gap-4">
          <WeatherWidget initialSnapshot={weatherSnapshot} />
          {user && <DailyGlance />}
          {user && (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">
                {user.email}
              </span>
              <a
                href="/api/export"
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Export My Data
              </a>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
