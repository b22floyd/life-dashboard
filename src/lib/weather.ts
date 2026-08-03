import type { HourlyForecast, WeatherSnapshot } from "@/lib/weather-utils";

const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
// Charlotte, NC — the default location, and the only one ever used on desktop.
export const DEFAULT_LATITUDE = 35.2271;
export const DEFAULT_LONGITUDE = -80.8431;

type OpenMeteoResponse = {
  current: { time: string; temperature_2m: number; weather_code: number };
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
};

// No server-only dependencies (just fetch/URL), so this is safe to call from
// both Server Components (the default Charlotte snapshot) and directly from
// the WeatherWidget Client Component (the on-device geolocation snapshot).
// Returns null on any failure (network error, non-200, unexpected shape) so
// callers can show a quiet fallback instead of crashing.
export async function getWeatherSnapshot(
  latitude: number = DEFAULT_LATITUDE,
  longitude: number = DEFAULT_LONGITUDE,
): Promise<WeatherSnapshot | null> {
  const url = new URL(FORECAST_ENDPOINT);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("hourly", "temperature_2m,weather_code");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("temperature_unit", "fahrenheit");
  // "auto" resolves to the local timezone for whatever coordinates were
  // passed in, rather than always assuming Charlotte's Eastern time.
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "2");

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    console.error("Failed to reach Open-Meteo:", error);
    return null;
  }

  if (!response.ok) {
    console.error("Open-Meteo API error:", response.status);
    return null;
  }

  let data: OpenMeteoResponse;
  try {
    data = (await response.json()) as OpenMeteoResponse;
  } catch (error) {
    console.error("Failed to parse Open-Meteo response:", error);
    return null;
  }

  if (!data.current || !data.hourly || !data.daily) {
    console.error("Unexpected Open-Meteo response shape.");
    return null;
  }

  // The hourly series covers the full day (including hours already past), so
  // start the 12-hour window right after the current hour rather than at 0.
  const currentIndex = data.hourly.time.indexOf(data.current.time);
  const startIndex = currentIndex === -1 ? 0 : currentIndex + 1;

  const hourly: HourlyForecast[] = data.hourly.time
    .slice(startIndex, startIndex + 12)
    .map((time, i) => ({
      time,
      temp: Math.round(data.hourly.temperature_2m[startIndex + i]),
      weatherCode: data.hourly.weather_code[startIndex + i],
    }));

  return {
    currentTemp: Math.round(data.current.temperature_2m),
    currentWeatherCode: data.current.weather_code,
    todayHigh: Math.round(data.daily.temperature_2m_max[0]),
    todayLow: Math.round(data.daily.temperature_2m_min[0]),
    hourly,
  };
}
