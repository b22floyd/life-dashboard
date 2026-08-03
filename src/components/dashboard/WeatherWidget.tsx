"use client";

import { useEffect, useRef, useState } from "react";
import type { WeatherSnapshot } from "@/lib/weather-utils";
import { formatHour, getWeatherIcon, getWeatherLabel } from "@/lib/weather-utils";

export function WeatherWidget({ snapshot }: { snapshot: WeatherSnapshot | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!snapshot) {
    return <span className="text-sm text-zinc-400 dark:text-zinc-500">Weather unavailable</span>;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <span aria-hidden>{getWeatherIcon(snapshot.currentWeatherCode)}</span>
        <span>{snapshot.currentTemp}°</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {getWeatherIcon(snapshot.currentWeatherCode)}
              </span>
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {snapshot.currentTemp}°F
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {getWeatherLabel(snapshot.currentWeatherCode)} · Charlotte, NC
                </p>
              </div>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              H:{snapshot.todayHigh}° L:{snapshot.todayLow}°
            </p>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {snapshot.hourly.map((hour) => (
              <div
                key={hour.time}
                className="flex shrink-0 flex-col items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300"
              >
                <span>{formatHour(hour.time)}</span>
                <span aria-hidden>{getWeatherIcon(hour.weatherCode)}</span>
                <span className="font-medium">{hour.temp}°</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
