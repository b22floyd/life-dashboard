export type HourlyForecast = {
  time: string; // ISO datetime
  temp: number;
  weatherCode: number;
};

export type WeatherSnapshot = {
  currentTemp: number;
  currentWeatherCode: number;
  todayHigh: number;
  todayLow: number;
  hourly: HourlyForecast[]; // next 12 hours, starting after the current hour
};

// WMO weather interpretation codes (used by Open-Meteo) mapped to a simple
// emoji + label. https://open-meteo.com/en/docs (see "WMO Weather interpretation codes")
const WEATHER_CODES: Record<number, { icon: string; label: string }> = {
  0: { icon: "☀️", label: "Clear" },
  1: { icon: "🌤️", label: "Mostly clear" },
  2: { icon: "⛅", label: "Partly cloudy" },
  3: { icon: "☁️", label: "Overcast" },
  45: { icon: "🌫️", label: "Fog" },
  48: { icon: "🌫️", label: "Fog" },
  51: { icon: "🌦️", label: "Light drizzle" },
  53: { icon: "🌦️", label: "Drizzle" },
  55: { icon: "🌦️", label: "Dense drizzle" },
  56: { icon: "🌧️", label: "Freezing drizzle" },
  57: { icon: "🌧️", label: "Freezing drizzle" },
  61: { icon: "🌧️", label: "Light rain" },
  63: { icon: "🌧️", label: "Rain" },
  65: { icon: "🌧️", label: "Heavy rain" },
  66: { icon: "🌧️", label: "Freezing rain" },
  67: { icon: "🌧️", label: "Freezing rain" },
  71: { icon: "🌨️", label: "Light snow" },
  73: { icon: "🌨️", label: "Snow" },
  75: { icon: "❄️", label: "Heavy snow" },
  77: { icon: "🌨️", label: "Snow grains" },
  80: { icon: "🌦️", label: "Rain showers" },
  81: { icon: "🌧️", label: "Rain showers" },
  82: { icon: "⛈️", label: "Violent showers" },
  85: { icon: "🌨️", label: "Snow showers" },
  86: { icon: "🌨️", label: "Snow showers" },
  95: { icon: "⛈️", label: "Thunderstorm" },
  96: { icon: "⛈️", label: "Thunderstorm w/ hail" },
  99: { icon: "⛈️", label: "Thunderstorm w/ hail" },
};

export function getWeatherIcon(code: number): string {
  return WEATHER_CODES[code]?.icon ?? "🌡️";
}

export function getWeatherLabel(code: number): string {
  return WEATHER_CODES[code]?.label ?? "Unknown";
}

export function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric" });
}
