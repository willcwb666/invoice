"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Sparkles,
} from "lucide-react";

interface PeriodData {
  label: string;
  subLabel?: string;
  revenue: number;
  expenses: number;
  profit: number;
  prevRevenue?: number;
}

export function DynamicRevenueChart() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [activeItem, setActiveItem] = useState<PeriodData | null>(null);
  const [series, setSeries] = useState<{ weekly: PeriodData[]; monthly: PeriodData[] }>({
    weekly: [],
    monthly: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/v1/dashboard/revenue-chart", { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          setSeries({ weekly: json.data?.weekly || [], monthly: json.data?.monthly || [] });
        }
      } catch {
        // ignore — chart falls back to the empty state below
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const dataset = period === "weekly" ? series.weekly : series.monthly;

  const totalRevenue = dataset.reduce((acc, d) => acc + d.revenue, 0);
  const totalExpenses = dataset.reduce((acc, d) => acc + d.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  const periodsWithPrev = dataset.filter((d) => d.prevRevenue !== undefined);
  const totalPrevRevenue = periodsWithPrev.reduce((acc, d) => acc + (d.prevRevenue || 0), 0);
  const hasGrowthBaseline = periodsWithPrev.length > 0 && totalPrevRevenue > 0;
  const growthPercent = hasGrowthBaseline
    ? (((totalRevenue - totalPrevRevenue) / totalPrevRevenue) * 100).toFixed(1)
    : null;
  const isPositive = growthPercent !== null && Number(growthPercent) >= 0;

  const maxVal =
    dataset.length > 0
      ? Math.max(...dataset.map((d) => Math.max(d.revenue, d.prevRevenue || 0)), 1) * 1.15
      : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6"
    >
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              Comparativo Dinâmico de Faturamento & Lucro
            </h3>
            {growthPercent !== null && (
              <span
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isPositive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {isPositive ? `+${growthPercent}%` : `${growthPercent}%`} vs anterior
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {period === "weekly"
              ? "Comparativo entre as semanas do mês vigente"
              : "Evolução do faturamento e despesas ao longo dos últimos meses"}
          </p>
        </div>

        {/* Period Selector Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 shadow-2xs self-start sm:self-auto">
          <button
            onClick={() => {
              setPeriod("weekly");
              setActiveItem(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              period === "weekly"
                ? "bg-white text-indigo-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Semanas
          </button>
          <button
            onClick={() => {
              setPeriod("monthly");
              setActiveItem(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              period === "monthly"
                ? "bg-white text-indigo-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Meses
          </button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-indigo-700 uppercase tracking-wider block">
              Faturamento no Período
            </span>
            <span className="text-lg font-black text-indigo-950 font-mono">
              ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-3 h-3 rounded-full bg-indigo-600 shrink-0" />
        </div>

        <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-rose-700 uppercase tracking-wider block">
              Despesas Operacionais
            </span>
            <span className="text-lg font-black text-rose-950 font-mono">
              ${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider block">
              Lucro Líquido Real
            </span>
            <span className="text-lg font-black text-emerald-950 font-mono">
              ${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-3 h-3 rounded-full bg-emerald-600 shrink-0" />
        </div>
      </div>

      {/* Dynamic Animated Bars Chart */}
      <div className="pt-4 border-t border-slate-100">
        {loading ? (
          <div className="h-56 w-full flex items-center justify-center text-xs text-slate-400">
            Carregando dados de faturamento...
          </div>
        ) : dataset.length === 0 ? (
          <div className="h-56 w-full flex items-center justify-center text-xs text-slate-400 text-center px-6">
            Ainda não há faturas ou despesas suficientes neste período para gerar o comparativo.
          </div>
        ) : (
        <div className="h-56 w-full flex items-end justify-between gap-3 sm:gap-6 px-2 pb-2">
          {dataset.map((item, idx) => {
            const revenueHeight = Math.round((item.revenue / maxVal) * 100);
            const prevHeight = item.prevRevenue
              ? Math.round((item.prevRevenue / maxVal) * 100)
              : 0;
            const isHovered = activeItem?.label === item.label;

            return (
              <div
                key={item.label}
                className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                onMouseEnter={() => setActiveItem(item)}
                onMouseLeave={() => setActiveItem(null)}
              >
                {/* Floating Tooltip */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full mb-3 z-30 bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl min-w-[160px] pointer-events-none"
                    >
                      <div className="font-bold text-[11px] text-indigo-300 pb-1 border-b border-slate-700">
                        {item.subLabel || item.label}
                      </div>
                      <div className="mt-1.5 space-y-1 text-[10px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Faturamento:</span>
                          <span className="font-bold text-indigo-300">
                            ${item.revenue.toFixed(2)}
                          </span>
                        </div>
                        {item.prevRevenue && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Anterior:</span>
                            <span className="text-slate-300">
                              ${item.prevRevenue.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Despesas:</span>
                          <span className="text-rose-300">
                            -${item.expenses.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-700 pt-1 text-emerald-300 font-bold">
                          <span>Lucro Líq.:</span>
                          <span>${item.profit.toFixed(2)}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bars Container */}
                <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full pb-1">
                  {/* Previous Period Bar (Ghost bar) */}
                  {prevHeight > 0 && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${prevHeight}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.06 }}
                      className="w-2.5 sm:w-4 rounded-t-md bg-slate-200 group-hover:bg-slate-300 transition-colors"
                      title="Período anterior"
                    />
                  )}

                  {/* Current Period Main Bar */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${revenueHeight}%` }}
                    transition={{ duration: 0.7, delay: idx * 0.08 }}
                    className={`w-4 sm:w-8 rounded-t-lg bg-gradient-to-t from-indigo-600 to-indigo-500 transition-all shadow-xs ${
                      isHovered
                        ? "from-indigo-500 to-indigo-400 shadow-md ring-2 ring-indigo-300"
                        : ""
                    }`}
                  />
                </div>

                {/* X Axis Label */}
                <div className="pt-2 text-center">
                  <span
                    className={`text-[11px] font-bold block transition-colors ${
                      isHovered ? "text-indigo-600 font-black" : "text-slate-600"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.subLabel && period === "weekly" && (
                    <span className="text-[9px] text-slate-400 block font-medium">
                      {item.subLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-5 pt-4 text-xs text-slate-500 border-t border-slate-100 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-indigo-600 to-indigo-500" />
            <span className="font-medium text-slate-700">Faturamento Vigente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-200" />
            <span className="font-medium text-slate-600">Período Anterior</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-700 font-medium">Passe o mouse nas barras para detalhar lucro e despesas</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
