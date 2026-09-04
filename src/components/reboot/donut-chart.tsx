"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight inline SVG donut chart. No charting library — pure geometry.
 * Segments are drawn as stroke-dasharray on a circle. Lime accent for the
 * largest segment, muted greys for the rest. Center shows the total.
 */
export interface DonutSegment {
  label: string;
  value: number;
  tone?: "lime" | "muted" | "amber" | "sky";
}

const TONE_COLORS: Record<NonNullable<DonutSegment["tone"]>, string> = {
  lime: "var(--primary)",
  muted: "oklch(0.40 0 0)",
  amber: "oklch(0.70 0.18 60)",
  sky: "oklch(0.65 0.12 220)",
};

export function DonutChart({
  segments,
  size = 96,
  thickness = 8,
  centerLabel,
  centerValue,
  className,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  // Assign lime to the largest segment, cycle others.
  const sortedIdx = [...segments.keys()].sort(
    (a, b) => segments[b].value - segments[a].value,
  );
  const toneFor = (i: number): NonNullable<DonutSegment["tone"]> => {
    if (i === sortedIdx[0]) return "lime";
    const palette: NonNullable<DonutSegment["tone"]>[] = [
      "muted",
      "amber",
      "sky",
    ];
    return palette[(i - 1 + palette.length) % palette.length] ?? "muted";
  };

  let offset = 0;
  const arcs = segments.map((seg, i) => {
    const fraction = total > 0 ? seg.value / total : 0;
    const dash = fraction * circumference;
    const tone = seg.tone ?? toneFor(i);
    const arc = {
      key: i,
      color: TONE_COLORS[tone],
      dash,
      offset: -offset * circumference,
      label: seg.label,
      value: seg.value,
      tone,
    };
    offset += fraction;
    return arc;
  });

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={thickness}
          />
          {total > 0 &&
            arcs.map((a) => (
              <circle
                key={a.key}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={a.color}
                strokeWidth={thickness}
                strokeDasharray={`${a.dash} ${circumference - a.dash}`}
                strokeDashoffset={a.offset}
                strokeLinecap="butt"
              />
            ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue !== undefined && (
            <span className="font-display font-bold text-lg text-foreground tabular-nums">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="mono-label text-[9px] text-muted-foreground">
              {centerLabel}
            </span>
          )}
        </div>
      </div>
      {/* Legend */}
      <div className="flex-1 min-w-0 space-y-1">
        {segments.map((seg, i) => {
          const tone = seg.tone ?? toneFor(i);
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className="size-2 rounded-sm shrink-0"
                style={{ background: TONE_COLORS[tone] }}
                aria-hidden
              />
              <span className="flex-1 truncate text-foreground">{seg.label}</span>
              <span className="mono-label text-muted-foreground tabular-nums">
                {seg.value} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
