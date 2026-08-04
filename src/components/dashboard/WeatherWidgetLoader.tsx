import { getWeatherSnapshot } from "@/lib/weather";
import { WeatherWidget } from "./WeatherWidget";

// A thin async wrapper so the weather fetch (a live call to Open-Meteo) can
// sit behind its own Suspense boundary in Header, independent of the
// title/date/account controls, which shouldn't have to wait on it.
export async function WeatherWidgetLoader() {
  const snapshot = await getWeatherSnapshot();
  return <WeatherWidget initialSnapshot={snapshot} />;
}
