"use client";

import { useMemo, useState } from "react";
import {
  getExerciseNames,
  getOneRepMaxSeries,
  WORKOUT_CATEGORIES,
  type WorkoutCategory,
  type WorkoutSession,
} from "@/lib/workout-utils";

const WIDTH = 600;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 28, left: 44 };
const Y_TICK_COUNT = 4;

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Rounds the data's min/max out to a "nice" step (a multiple of 5 lb, since
// that's how plates and dumbbells actually increment) so the axis reads like
// a real scale — e.g. 210/220/230/240 — rather than the raw, oddly-specific
// min/max of whatever Epley's formula happened to compute.
function getYAxisTicks(dataMin: number, dataMax: number, tickCount: number): number[] {
  let min = dataMin;
  let max = dataMax;
  if (min === max) {
    const pad = Math.max(5, Math.round(min * 0.05));
    min -= pad;
    max += pad;
  }

  const rawStep = (max - min) / (tickCount - 1);
  const step = Math.max(5, Math.ceil(rawStep / 5) * 5);
  const niceMin = Math.floor(min / step) * step;

  return Array.from({ length: tickCount }, (_, i) => niceMin + i * step);
}

export function ProgressChart({ sessions }: { sessions: WorkoutSession[] }) {
  const [category, setCategory] = useState<WorkoutCategory>(WORKOUT_CATEGORIES[0]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const categorySessions = useMemo(
    () => sessions.filter((session) => session.category === category),
    [sessions, category],
  );
  const exerciseNames = useMemo(() => getExerciseNames(categorySessions), [categorySessions]);

  const [selected, setSelected] = useState(exerciseNames[0] ?? "");

  // Reset the selected exercise when the available list for this category
  // changes (most commonly: switching tabs), following React's "adjusting
  // state when a prop changes" pattern rather than an effect + setState.
  const [handledExerciseNames, setHandledExerciseNames] = useState(exerciseNames);
  const exerciseNamesChanged =
    exerciseNames.length !== handledExerciseNames.length ||
    exerciseNames.some((name, i) => name !== handledExerciseNames[i]);
  if (exerciseNamesChanged) {
    setHandledExerciseNames(exerciseNames);
    if (!exerciseNames.includes(selected)) {
      setSelected(exerciseNames[0] ?? "");
      setHoverIndex(null);
    }
  }

  const series = useMemo(
    () => (selected ? getOneRepMaxSeries(categorySessions, selected) : []),
    [categorySessions, selected],
  );

  const oneRepMaxes = series.map((point) => point.oneRepMax);
  const minOneRepMax = oneRepMaxes.length ? Math.min(...oneRepMaxes) : 0;
  const maxOneRepMax = oneRepMaxes.length ? Math.max(...oneRepMaxes) : 0;

  const yTicks = oneRepMaxes.length ? getYAxisTicks(minOneRepMax, maxOneRepMax, Y_TICK_COUNT) : [];
  const axisMin = yTicks.length ? yTicks[0] : 0;
  const axisMax = yTicks.length ? yTicks[yTicks.length - 1] : 1;
  const axisRange = axisMax - axisMin || 1;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  function valueToY(value: number) {
    return PADDING.top + plotHeight - ((value - axisMin) / axisRange) * plotHeight;
  }

  const points = series.map((point, index) => {
    const x =
      PADDING.left + (series.length > 1 ? (index / (series.length - 1)) * plotWidth : plotWidth / 2);
    return { ...point, x, y: valueToY(point.oneRepMax) };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const startValue = points.length ? points[0].oneRepMax : null;
  const currentValue = points.length ? points[points.length - 1].oneRepMax : null;
  const delta = startValue !== null && currentValue !== null ? currentValue - startValue : null;

  return (
    <div>
      <div className="mb-3 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {WORKOUT_CATEGORIES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            className={
              category === option
                ? "border-b-2 border-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-b-2 border-transparent px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            }
          >
            {option}
          </button>
        ))}
      </div>

      {exerciseNames.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No {category.toLowerCase()} workouts logged yet.
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Estimated 1RM — {selected}
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

          {startValue !== null && currentValue !== null && (
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
              {points.length > 1 ? (
                <>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {Math.round(startValue)} lb
                  </span>{" "}
                  →{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {Math.round(currentValue)} lb
                  </span>
                  {delta !== null && delta !== 0 && (
                    <span
                      className={
                        delta > 0
                          ? "ml-2 text-emerald-600 dark:text-emerald-400"
                          : "ml-2 text-red-600 dark:text-red-400"
                      }
                    >
                      ({delta > 0 ? "+" : ""}
                      {Math.round(delta)} lb)
                    </span>
                  )}
                </>
              ) : (
                <>
                  Current:{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {Math.round(currentValue)} lb
                  </span>
                </>
              )}
            </p>
          )}

          {points.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">No logged sets yet.</p>
          ) : (
            <div className="relative">
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full"
                role="img"
                aria-label={`Estimated one-rep max over time for ${selected}`}
                onClick={() => setHoverIndex(null)}
              >
                {yTicks.map((tick) => {
                  const y = valueToY(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={PADDING.left}
                        y1={y}
                        x2={WIDTH - PADDING.right}
                        y2={y}
                        className="stroke-zinc-100 dark:stroke-zinc-800/60"
                        strokeWidth={1}
                      />
                      <text
                        x={PADDING.left - 8}
                        y={y}
                        dominantBaseline="middle"
                        textAnchor="end"
                        className="fill-zinc-400 text-[10px] dark:fill-zinc-500"
                      >
                        {Math.round(tick)}
                      </text>
                    </g>
                  );
                })}

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
                      className="fill-blue-600 dark:fill-blue-400"
                      pointerEvents="none"
                    />
                    {/* Wider, invisible hit target than the 4px dot itself
                        (painted on top, so it owns all pointer events) —
                        tapping near a point on a touchscreen, with no hover
                        to land on the exact pixel first, still registers. */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={12}
                      className="cursor-pointer fill-transparent"
                      onMouseEnter={() => setHoverIndex(index)}
                      onMouseLeave={() =>
                        setHoverIndex((current) => (current === index ? null : current))
                      }
                      onClick={(e) => {
                        // Not a toggle: touch (and Playwright's .click())
                        // synthesizes a mouseenter right before the click
                        // event, which already sets hoverIndex to this same
                        // index — toggling here would immediately flip it
                        // back off on every real tap.
                        e.stopPropagation();
                        setHoverIndex(index);
                      }}
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

              {hoverIndex !== null && (() => {
                // A CSS quirk with an absolutely-positioned, auto-width box:
                // when `left` sits near the container's right edge, the
                // "shrink-to-fit" width calculation only has a sliver of
                // space to work with and squeezes the box down to that,
                // wrapping the text instead of respecting its natural
                // single-line width. Anchoring by the tooltip's own left/
                // right edge (instead of always centering) for points near
                // either end keeps the full box within the chart's bounds.
                const xFraction = points[hoverIndex].x / WIDTH;
                const translateX = xFraction > 0.85 ? "-100%" : xFraction < 0.15 ? "0%" : "-50%";
                return (
                  <div
                    className="pointer-events-none absolute rounded-md bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900"
                    style={{
                      left: `${xFraction * 100}%`,
                      top: `${(points[hoverIndex].y / HEIGHT) * 100}%`,
                      transform: `translate(${translateX}, -130%)`,
                    }}
                  >
                    {formatShortDate(points[hoverIndex].date)}: {Math.round(points[hoverIndex].oneRepMax)} lb
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
