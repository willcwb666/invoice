"use client";

import React, { useMemo } from "react";
import { create as createQRCode } from "qrcode";

// Renders a real, spec-compliant QR Code (RFC/ISO 18004) as SVG using the
// `qrcode` package's pure matrix builder (Reed-Solomon error correction,
// real finder/timing/format/version info) — this backs the Zelle/Venmo
// payment QR in payment-modal.tsx, so it has to actually scan.
interface QRCodeSVGProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  className?: string;
}

export function QRCodeSVG({
  value,
  size = 200,
  fgColor = "#0f172a",
  bgColor = "#ffffff",
  className = "",
}: QRCodeSVGProps) {
  const modules = useMemo(() => {
    try {
      return createQRCode(value, { errorCorrectionLevel: "M" }).modules;
    } catch {
      return null;
    }
  }, [value]);

  if (!modules) return null;

  const numCells = modules.size;
  const cellSize = size / numCells;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`rounded-xl shadow-xs ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={size} height={size} fill={bgColor} rx="12" />
      <g fill={fgColor}>
        {Array.from({ length: numCells }, (_, r) =>
          Array.from({ length: numCells }, (_, c) =>
            modules.get(r, c) ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize + 0.1}
                height={cellSize + 0.1}
              />
            ) : null
          )
        )}
      </g>
    </svg>
  );
}
