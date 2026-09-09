"use client";

import React from "react";
import Link from "next/link";
import { Tooltip } from "./tooltip";

export type ActionButtonHoverColor =
  | "blue"
  | "red"
  | "green"
  | "orange"
  | "yellow"
  | "purple"
  | "default";

export type ActionButtonActiveColor = "orange" | "green" | "none";

interface ActionButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  hoverColor?: ActionButtonHoverColor;
  activeColor?: ActionButtonActiveColor;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  target?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

const hoverClasses: Record<ActionButtonHoverColor, string> = {
  blue: "hover:text-blue-600 hover:bg-blue-50/90 hover:border-blue-300",
  red: "hover:text-rose-600 hover:bg-rose-50/90 hover:border-rose-300",
  green: "hover:text-emerald-600 hover:bg-emerald-50/90 hover:border-emerald-300",
  orange: "hover:text-amber-600 hover:bg-amber-50/90 hover:border-amber-300",
  yellow: "hover:text-yellow-600 hover:bg-yellow-50/90 hover:border-yellow-300",
  purple: "hover:text-indigo-600 hover:bg-indigo-50/90 hover:border-indigo-300",
  default: "hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300",
};

const activeClasses: Record<ActionButtonActiveColor, string> = {
  orange: "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300",
  green: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300",
  none: "text-slate-500 bg-white border-slate-200/90",
};

export function ActionButton({
  icon,
  tooltip,
  hoverColor = "blue",
  activeColor = "none",
  onClick,
  href,
  target,
  disabled = false,
  className = "",
  ariaLabel,
}: ActionButtonProps) {
  const baseClasses = `p-2 rounded-xl border transition-all duration-200 flex items-center justify-center shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed ${
    activeColor !== "none" ? activeClasses[activeColor] : activeClasses.none
  } ${hoverClasses[hoverColor]} ${className}`;

  const content = href ? (
    <Link
      href={href}
      target={target}
      aria-label={ariaLabel || tooltip}
      className={baseClasses}
      onClick={onClick}
    >
      {icon}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || tooltip}
      className={baseClasses}
    >
      {icon}
    </button>
  );

  return <Tooltip content={tooltip}>{content}</Tooltip>;
}
