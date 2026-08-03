"use client";

import { useState } from "react";
import type { RecoveryPoint } from "@/lib/whoop-utils";
import { useHasMounted } from "@/lib/use-has-mounted";

const WIDTH = 600;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 28, left: 40 };

function formatShortDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function RecoveryTrendChart({ data }: { data: RecoveryPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // These are absolute timestamps now (fixed from a server-side UTC-day
  // bucketing bug), so formatting them genuinely differs between the
  // server's timezone and the browser's — wait for mount rather than let
  // React fight a real hydration mismatch on the axis labels.
  const mounted = useHasMounted();

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  // Recovery score is always 0-100, so the y-axis is fixed rather than
  // scaled to the data's min/max like the workout progress chart.
  const points = data.map((point, index) => {
    const x =
      PADDING.left + (data.length > 1 ? (index / (data.length - 1)) * plotWidth : plotWidth / 2);
    const y = PADDING.top + plotHeight - (point.recoveryScore / 100) * plotHeight;
    return { ...point, x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Recovery — last 7 days
      </h3>

      {points.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No recovery data yet.</p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label="Recovery score over the last 7 days"
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
                className="stroke-green-600 dark:stroke-green-400"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {points.map((p, index) => (
              <g key={p.timestamp + index}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === index ? 6 : 4}
                  className="cursor-pointer fill-green-600 dark:fill-green-400"
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
                    {mounted ? formatShortDate(p.timestamp) : ""}
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
              {formatShortDate(points[hoverIndex].timestamp)}: {points[hoverIndex].recoveryScore}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
