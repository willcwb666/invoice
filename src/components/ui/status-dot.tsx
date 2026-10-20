"use client";

import React from "react";
import { Tooltip } from "@/components/ui/tooltip";

export type StatusDotColor =
  | "green"
  | "emerald"
  | "orange"
  | "amber"
  | "red"
  | "rose"
  | "indigo"
  | "blue"
  | "slate";

export type StatusDotSize = "sm" | "md" | "lg";

interface StatusDotProps {
  color?: StatusDotColor;
  size?: StatusDotSize;
  pulse?: boolean;
  tooltip?: string;
  className?: string;
}

const colorMap: Record<StatusDotColor, { bg: string; ring: string }> = {
  green: { bg: "bg-emerald-500", ring: "ring-emerald-200/80" },
  emerald: { bg: "bg-emerald-500", ring: "ring-emerald-200/80" },
  orange: { bg: "bg-amber-500", ring: "ring-amber-200/80" },
  amber: { bg: "bg-amber-500", ring: "ring-amber-200/80" },
  red: { bg: "bg-rose-500", ring: "ring-rose-200/80" },
  rose: { bg: "bg-rose-500", ring: "ring-rose-200/80" },
  indigo: { bg: "bg-indigo-500", ring: "ring-indigo-200/80" },
  blue: { bg: "bg-blue-500", ring: "ring-blue-200/80" },
  slate: { bg: "bg-slate-400", ring: "ring-slate-200" },
};

const sizeMap: Record<StatusDotSize, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
};

export function StatusDot({
  color = "emerald",
  size = "md",
  pulse = true,
  tooltip,
  className = "",
}: StatusDotProps) {
  const { bg, ring } = colorMap[color] || colorMap.emerald;
  const sizeClass = sizeMap[size] || sizeMap.md;

  const dot = (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
    >
      <span
        className={`${sizeClass} rounded-full ${bg} ring-2 ${ring} ${
          pulse ? "animate-pulse" : ""
        } shrink-0`}
      />
    </span>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} position="top">
        <span className="inline-flex cursor-help">{dot}</span>
      </Tooltip>
    );
  }

  return dot;
}
