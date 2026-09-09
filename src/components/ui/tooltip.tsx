"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({
  content,
  children,
  position = "top",
  delay = 120,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [effectivePosition, setEffectivePosition] = useState(position);
  const [horizontalAlign, setHorizontalAlign] = useState<"center" | "right" | "left">("center");

  const calculatePlacement = useCallback(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    const rect = containerRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const rightMargin = windowWidth - rect.right;
    const leftMargin = rect.left;
    const topMargin = rect.top;
    const bottomMargin = windowHeight - rect.bottom;

    let targetPos = position;

    // 1. Vertical boundary detection & auto-flip
    if (position === "top" && topMargin < 48 && bottomMargin >= 48) {
      targetPos = "bottom";
    } else if (position === "bottom" && bottomMargin < 48 && topMargin >= 48) {
      targetPos = "top";
    }

    // 2. Horizontal boundary detection & auto-flip for left/right
    if (targetPos === "right" && rightMargin < 140) {
      targetPos = leftMargin >= 140 ? "left" : "top";
    } else if (targetPos === "left" && leftMargin < 140) {
      targetPos = rightMargin >= 140 ? "right" : "top";
    }

    setEffectivePosition(targetPos);

    // 3. Horizontal alignment anti-overflow for top/bottom
    if (targetPos === "top" || targetPos === "bottom") {
      if (rightMargin < 130) {
        setHorizontalAlign("right"); // Pin balloon to right edge of trigger
      } else if (leftMargin < 130) {
        setHorizontalAlign("left"); // Pin balloon to left edge of trigger
      } else {
        setHorizontalAlign("center");
      }
    }
  }, [position]);

  const handleMouseEnter = () => {
    calculatePlacement();
    const t = setTimeout(() => {
      calculatePlacement();
      setIsVisible(true);
    }, delay);
    setTimer(t);
  };

  const handleMouseLeave = () => {
    if (timer) clearTimeout(timer);
    setIsVisible(false);
  };

  // Compute balloon classes based on effective position and horizontal alignment
  const getBalloonClass = () => {
    if (effectivePosition === "top") {
      if (horizontalAlign === "right") return "bottom-full right-0 mb-2";
      if (horizontalAlign === "left") return "bottom-full left-0 mb-2";
      return "bottom-full left-1/2 -translate-x-1/2 mb-2";
    }
    if (effectivePosition === "bottom") {
      if (horizontalAlign === "right") return "top-full right-0 mt-2";
      if (horizontalAlign === "left") return "top-full left-0 mt-2";
      return "top-full left-1/2 -translate-x-1/2 mt-2";
    }
    if (effectivePosition === "left") {
      return "right-full top-1/2 -translate-y-1/2 mr-2";
    }
    return "left-full top-1/2 -translate-y-1/2 ml-2";
  };

  // Compute arrow classes matching the balloon position
  const getArrowClass = () => {
    if (effectivePosition === "top") {
      if (horizontalAlign === "right") {
        return "top-full right-3 border-t-slate-900 border-x-transparent border-b-transparent border-t-4 border-x-4";
      }
      if (horizontalAlign === "left") {
        return "top-full left-3 border-t-slate-900 border-x-transparent border-b-transparent border-t-4 border-x-4";
      }
      return "top-full left-1/2 -translate-x-1/2 border-t-slate-900 border-x-transparent border-b-transparent border-t-4 border-x-4";
    }
    if (effectivePosition === "bottom") {
      if (horizontalAlign === "right") {
        return "bottom-full right-3 border-b-slate-900 border-x-transparent border-t-transparent border-b-4 border-x-4";
      }
      if (horizontalAlign === "left") {
        return "bottom-full left-3 border-b-slate-900 border-x-transparent border-t-transparent border-b-4 border-x-4";
      }
      return "bottom-full left-1/2 -translate-x-1/2 border-b-slate-900 border-x-transparent border-t-transparent border-b-4 border-x-4";
    }
    if (effectivePosition === "left") {
      return "left-full top-1/2 -translate-y-1/2 border-l-slate-900 border-y-transparent border-r-transparent border-l-4 border-y-4";
    }
    return "right-full top-1/2 -translate-y-1/2 border-r-slate-900 border-y-transparent border-l-transparent border-r-4 border-y-4";
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && content && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: effectivePosition === "top" ? 3 : effectivePosition === "bottom" ? -3 : 0,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={`absolute z-50 pointer-events-none px-2.5 py-1 text-[11px] font-medium text-white bg-slate-900 rounded-lg shadow-xl w-max max-w-[calc(100vw-32px)] sm:max-w-[280px] break-words whitespace-normal leading-tight select-none ${getBalloonClass()}`}
          >
            {content}
            <span className={`absolute w-0 h-0 ${getArrowClass()}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
