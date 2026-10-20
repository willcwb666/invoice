"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, CalendarDays } from "lucide-react";

export type PeriodMode = "weekly" | "monthly";

interface PeriodToggleProps {
  value: PeriodMode;
  onChange: (value: PeriodMode) => void;
  className?: string;
}

export function PeriodToggle({ value, onChange, className = "" }: PeriodToggleProps) {
  const isWeekly = value === "weekly";

  const handleToggle = () => {
    onChange(isWeekly ? "monthly" : "weekly");
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Período: ${isWeekly ? "Semanal" : "Mensal"}. Clique para alterar.`}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleToggle();
        }
      }}
      className={`inline-flex items-center gap-2.5 px-2 py-1 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all cursor-pointer select-none group focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
    >
      {/* O Switch com ícones de Calendário */}
      <div
        className={`relative w-16 h-8 rounded-full p-1 transition-colors duration-300 flex items-center shadow-inner ${
          isWeekly
            ? "bg-[#18181b] border border-black/40"
            : "bg-[#e4e4e7] border border-slate-300/80"
        }`}
      >
        {/* Ícone de Calendário Mensal no lado esquerdo */}
        {!isWeekly && (
          <div className="absolute left-2 text-slate-800 flex items-center justify-center pointer-events-none">
            <Calendar className="w-4 h-4 text-slate-700 stroke-[2.2]" />
          </div>
        )}

        {/* Ícone de Calendário Semanal no lado direito */}
        {isWeekly && (
          <div className="absolute right-2 text-white flex items-center justify-center pointer-events-none">
            <CalendarDays className="w-4 h-4 text-white stroke-[2.2]" />
          </div>
        )}

        {/* A bolinha deslizante com animação spring */}
        <motion.div
          animate={{
            x: isWeekly ? 0 : 32,
            backgroundColor: isWeekly ? "#ffffff" : "#18181b",
          }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 32,
          }}
          className={`w-6 h-6 rounded-full shadow-md pointer-events-none flex items-center justify-center ${
            isWeekly ? "bg-white" : "bg-[#18181b]"
          }`}
          style={{
            boxShadow: isWeekly
              ? "0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(0,0,0,0.1)"
              : "0 2px 4px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.15)",
          }}
        />
      </div>

      {/* Texto descritivo que muda dinamicamente */}
      <div className="flex flex-col text-left pr-1.5">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
          Visualização
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={value}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.15 }}
            className="text-xs font-black text-slate-900 tracking-tight leading-tight mt-0.5"
          >
            {isWeekly ? "Semanal" : "Mensal"}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
