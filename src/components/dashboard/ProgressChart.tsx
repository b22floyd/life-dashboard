"use client";

import { useMemo, useState } from "react";
import { getExerciseNames, getMaxWeightSeries, type WorkoutSession } from "@/lib/workout-utils";

const WIDTH = 600;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 28, left: 40 };

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ProgressChart({ sessions }: { sessions: WorkoutSession[] }) {
  const exerciseNames = useMemo(() => getExerciseNames(sessions), [sessions]);
  const [selected, setSelected] = useState(exerciseNames[0] ?? "");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = useMemo(
    () => (selected ? getMaxWeightSeries(sessions, selected) : []),
    [sessions, selected],
  );

  if (exerciseNames.length === 0) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        Log a workout to see your progress chart.
      </p>
    );
  }

  const weights = series.map((point) => point.maxWeight);
  const minWeight = weights.length ? Math.min(...weights) : 0;
  const maxWeight = weights.length ? Math.max(...weights) : 0;
  const weightRange = maxWeight - minWeight || 1;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const points = series.map((point, index) => {
    const x =
      PADDING.left + (series.length > 1 ? (index / (series.length - 1)) * plotWidth : plotWidth / 2);
    const y =
      PADDING.top +
      plotHeight -
      ((point.maxWeight - minWeight) / weightRange) * plotHeight;
    return { ...point, x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Max weight — {selected}
        </h3>
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setHoverIndex(null);
          }}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
        >
          {exerciseNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {points.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No logged sets yet.</p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label={`Max weight over time for ${selected}`}
          >
            <line
              x1={PADDING.left}
              y1={PADDING.top + plotHeight}
              x2={WIDTH - PADDING.right}
              y2={PADDING.top + plotHeight}
              className="stroke-zinc-200 dark:stroke-zinc-800"
              strokeWidth={1}
            />

            {points.length > 1 && (
              <path
                d={linePath}
                fill="none"
                className="stroke-blue-600 dark:stroke-blue-400"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {points.map((p, index) => (
              <g key={p.date + index}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === index ? 6 : 4}
                  className="cursor-pointer fill-blue-600 dark:fill-blue-400"
                  onMouseEnter={() => setHoverIndex(index)}
                  onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
                />
                {(index === 0 ||
                  index === points.length - 1 ||
                  index === Math.floor(points.length / 2)) && (
                  <text
                    x={p.x}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-zinc-400 text-[10px] dark:fill-zinc-500"
                  >
                    {formatShortDate(p.date)}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {hoverIndex !== null && (
            <div
              className="pointer-events-none absolute rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900"
              style={{
                left: `${(points[hoverIndex].x / WIDTH) * 100}%`,
                top: `${(points[hoverIndex].y / HEIGHT) * 100}%`,
                transform: "translate(-50%, -130%)",
              }}
            >
              {formatShortDate(points[hoverIndex].date)}: {points[hoverIndex].maxWeight} lb
            </div>
          )}
        </div>
      )}
    </div>
  );
}
