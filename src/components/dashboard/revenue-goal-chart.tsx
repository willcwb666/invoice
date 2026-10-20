"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Calendar, TrendingUp, CheckCircle2, ArrowUpRight } from "lucide-react";
import { PeriodMode } from "@/components/dashboard/period-toggle";

interface GoalData {
  period?: PeriodMode;
  targetGoal: number;
  monthlyGoal: number;
  currentBilled: number;
  paidAmount: number;
  remaining: number;
  progressPercent: number;
  projectedFromAgenda: number;
  totalProjected: number;
  projectedProgressPercent: number;
  isGoalReached: boolean;
}

interface RevenueGoalChartProps {
  goal: GoalData | null;
  period: PeriodMode;
}

export function RevenueGoalChart({ goal, period }: RevenueGoalChartProps) {
  if (!goal) return null;

  const isWeekly = period === "weekly";
  const target = goal.targetGoal || (isWeekly ? 1500 : 6000);
  const currentBilled = goal.currentBilled || 0;
  const projectedFromAgenda = goal.projectedFromAgenda || 0;
  // O acompanhamento de meta é calculado rigorosamente pelo total da agenda no período
  const totalScheduled = goal.totalProjected ?? goal.projectedFromAgenda ?? currentBilled;
  const remaining = Math.max(0, target - totalScheduled);
  const progressPercent = Math.min(100, Math.round((totalScheduled / target) * 100));
  const billedPercent = Math.min(100, Math.round((currentBilled / target) * 100));

  // Configurações do SVG Circular Gauge
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const scheduledStrokeDashoffset = circumference - (circumference * progressPercent) / 100;
  const billedStrokeDashoffset = circumference - (circumference * billedPercent) / 100;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        {/* Lado Esquerdo: Identificação e Números */}
        <div className="space-y-4 max-w-lg">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
              <Flame className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                Acompanhamento de Meta
              </span>
              <h3 className="text-sm font-black text-slate-900">
                Meta de Faturamento {isWeekly ? "Semanal" : "Mensal"} (Base Agendada)
              </h3>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={`${period}-${totalScheduled}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight"
                >
                  ${totalScheduled.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </motion.h2>
              </AnimatePresence>
              <span className="text-sm font-semibold text-slate-500">
                de ${target.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <p className="text-xs text-slate-600">
              {goal.isGoalReached || totalScheduled >= target ? (
                <span className="text-emerald-700 font-bold inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Meta {isWeekly ? "semanal" : "mensal"} atingida com os agendamentos da equipe!
                </span>
              ) : (
                <span>
                  Faltam apenas{" "}
                  <strong className="text-amber-700 font-bold">
                    ${remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </strong>{" "}
                  agendados para atingir a meta {isWeekly ? "desta semana" : "deste mês"}.
                </span>
              )}
            </p>
          </div>

          {/* Breakdown em 3 pilares */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="p-2.5 rounded-2xl bg-emerald-50/80 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-800 block">Já Concluído</span>
              <span className="text-xs font-black text-emerald-950">
                ${currentBilled.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-indigo-50/80 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-800 block flex items-center gap-1">
                <span>Total na Agenda</span>
                <Calendar className="w-2.5 h-2.5 text-indigo-600" />
              </span>
              <span className="text-xs font-black text-indigo-950">
                ${totalScheduled.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-amber-50/80 border border-amber-100">
              <span className="text-[10px] font-bold text-amber-800 block">Restante p/ Meta</span>
              <span className="text-xs font-black text-amber-950">
                ${remaining.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Lado Direito: Gráfico Circular / Donut Progress Gauge */}
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-end bg-slate-50/60 p-5 rounded-2xl border border-slate-100">
          <div className="relative flex items-center justify-center shrink-0">
            <svg width={size} height={size} className="rotate-[-90deg]">
              {/* Background Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#e2e8f0"
                strokeWidth={strokeWidth}
                fill="transparent"
              />

              {/* Total Scheduled Ring (Arco principal sólido cobrindo toda a agenda) */}
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="url(#goalGradient)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: scheduledStrokeDashoffset }}
                transition={{ duration: 1, ease: "easeOut" }}
                strokeLinecap="round"
                fill="transparent"
              />

              {/* Already Billed/Completed segment */}
              {billedPercent > 0 && billedPercent < progressPercent && (
                <motion.circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#059669"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: billedStrokeDashoffset }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  strokeLinecap="round"
                  fill="transparent"
                />
              )}

              <defs>
                <linearGradient id="goalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>

            {/* Texto Central do Gráfico */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.span
                  key={`${period}-${progressPercent}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="text-2xl font-black text-slate-900 tracking-tight"
                >
                  {progressPercent}%
                </motion.span>
              </AnimatePresence>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Agendado
              </span>
            </div>
          </div>

          {/* Legenda Lateral do Gráfico */}
          <div className="space-y-2.5 text-xs text-slate-600 min-w-[150px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span>Total Agendado: <strong className="text-slate-900">{progressPercent}%</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-700 shrink-0" />
              <span>Já Realizado: <strong className="text-slate-900">{billedPercent}%</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-300 shrink-0" />
              <span>Meta Base: <strong className="text-slate-900">100%</strong></span>
            </div>

            <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-200">
              Total na Agenda: <strong className="text-emerald-700">${totalScheduled.toLocaleString("en-US", { minimumFractionDigits: 0 })}</strong>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
