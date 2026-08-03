"use client";

import { useState } from "react";
import type { WeightEntry } from "@/lib/weight-utils";

const WIDTH = 600;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 28, left: 40 };

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function WeightTrendChart({
  entries,
  goalWeight,
}: {
  entries: WeightEntry[];
  goalWeight: number | null;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const weights = entries.map((entry) => entry.weight);
  const allValues = goalWeight !== null ? [...weights, goalWeight] : weights;
  const rawMin = allValues.length ? Math.min(...allValues) : 0;
  const rawMax = allValues.length ? Math.max(...allValues) : 0;
  const rawRange = rawMax - rawMin || 1;
  // Pad the value range so the goal reference line never sits flush against
  // the top/bottom edge of the plot.
  const valuePadding = rawRange * 0.1;
  const min = rawMin - valuePadding;
  const max = rawMax + valuePadding;
  const range = max - min;

  const points = entries.map((entry, index) => {
    const x =
      PADDING.left + (entries.length > 1 ? (index / (entries.length - 1)) * plotWidth : plotWidth / 2);
    const y = PADDING.top + plotHeight - ((entry.weight - min) / range) * plotHeight;
    return { ...entry, x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const goalY =
    goalWeight !== null ? PADDING.top + plotHeight - ((goalWeight - min) / range) * plotHeight : null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Weight over time</h3>

      {points.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No weight logged yet.</p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label="Weight over time"
          >
            <line
              x1={PADDING.left}
              y1={PADDING.top + plotHeight}
              x2={WIDTH - PADDING.right}
              y2={PADDING.top + plotHeight}
              className="stroke-zinc-200 dark:stroke-zinc-800"
              strokeWidth={1}
            />

            {goalY !== null && (
              <>
                <line
                  x1={PADDING.left}
                  y1={goalY}
                  x2={WIDTH - PADDING.right}
                  y2={goalY}
                  className="stroke-amber-500 dark:stroke-amber-400"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <text
                  x={WIDTH - PADDING.right}
                  y={goalY - 4}
                  textAnchor="end"
                  className="fill-amber-600 text-[10px] dark:fill-amber-400"
                >
                  Goal: {goalWeight} lb
                </text>
              </>
            )}

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
              <g key={p.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === index ? 6 : 4}
                  className="cursor-pointer fill-blue-600 dark:fill-blue-400"
                  onMouseEnter={() => setHoverIndex(index)}
                  onMouseLeave={() =>
                    setHoverIndex((current) => (current === index ? null : current))
                  }
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
                    {formatShortDate(p.entryDate)}
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
              {formatShortDate(points[hoverIndex].entryDate)}: {points[hoverIndex].weight} lb
            </div>
          )}
        </div>
      )}
    </div>
  );
}
