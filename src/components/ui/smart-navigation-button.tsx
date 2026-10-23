"use client";

import React, { useState } from "react";
import { Navigation, MapPin, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  buildGoogleMapsUrl,
  buildAppleMapsUrl,
  isIosUserAgent,
} from "@/lib/navigation";

interface SmartNavigationButtonProps {
  address: string;
  city?: string;
  state?: string;
  tooltip?: string;
  variant?: "icon" | "full";
  className?: string;
}

export function SmartNavigationButton({
  address,
  city,
  state,
  tooltip = "Navegar até endereço",
  variant = "icon",
  className = "",
}: SmartNavigationButtonProps) {
  const [isIosModalOpen, setIsIosModalOpen] = useState(false);

  if (!address || !address.trim()) return null;

  const googleUrl = buildGoogleMapsUrl(address, city, state);
  const appleUrl = buildAppleMapsUrl(address, city, state);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isIos = isIosUserAgent();

    if (isIos) {
      setIsIosModalOpen(true);
    } else {
      window.open(googleUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleOpenGoogle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsIosModalOpen(false);
    window.open(googleUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenApple = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsIosModalOpen(false);
    window.location.href = appleUrl;
  };

  return (
    <>
      {variant === "icon" ? (
        <Tooltip content={tooltip}>
          <button
            type="button"
            onClick={handleClick}
            aria-label={tooltip}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors border border-slate-200/90 text-slate-600 bg-white hover:text-emerald-600 hover:bg-emerald-50/90 hover:border-emerald-300 cursor-pointer ${className}`}
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        </Tooltip>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold shadow-2xs flex items-center justify-center gap-2 border border-emerald-200 transition-colors cursor-pointer ${className}`}
        >
          <Navigation className="w-4 h-4 text-emerald-600" />
          <span>Navegar até endereço</span>
        </button>
      )}

      {/* iOS Modal Selection Dialog */}
      {isIosModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setIsIosModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Navegar até o Endereço
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Escolha seu app de navegação
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIosModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2 text-xs text-slate-600">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-mono text-[11px] leading-tight break-words">
                {address}
                {city ? `, ${city}` : ""}
                {state ? ` - ${state}` : ""}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleOpenGoogle}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4" />
                <span>Navegar no Google Maps</span>
              </button>

              <button
                type="button"
                onClick={handleOpenApple}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4 text-indigo-600" />
                <span>Navegar no Apple Maps</span>
              </button>

              <button
                type="button"
                onClick={() => setIsIosModalOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl text-slate-500 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
