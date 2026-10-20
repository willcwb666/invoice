"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/dashboard/header";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Fuel,
  Users,
  Sparkles,
  BarChart3,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Wallet,
  Receipt,
  FileText,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building2,
  Landmark,
  Layers,
  ShoppingBag,
  Wrench,
  Utensils,
  X,
  Loader2,
} from "lucide-react";

type FinancialPeriod = "month" | "last_month" | "quarter" | "year" | "all";

interface DashboardData {
  period: FinancialPeriod;
  periodLabel: string;
  startDate: string;
  endDate: string;
  kpis: {
    grossRevenue: {
      value: number;
      prevValue: number;
      growthPercent: number | null;
      isPositive: boolean;
    };
    totalReceived: {
      value: number;
      prevValue: number;
      growthPercent: number | null;
      isPositive: boolean;
    };
    totalPending: {
      value: number;
      overdueAmount: number;
    };
    totalExpenses: {
      value: number;
      prevValue: number;
      growthPercent: number | null;
      isPositive: boolean;
    };
    netProfit: {
      value: number;
      prevValue: number;
      growthPercent: number | null;
      isPositive: boolean;
    };
    profitMargin: {
      value: number;
      isHealthy: boolean;
    };
    averageTicket: {
      value: number;
      cleaningsCount: number;
    };
    agendaTotal: {
      value: number;
      count: number;
    };
  };
  dre: {
    grossRevenueCleanings: number;
    grossRevenueInvoices: number;
    grossRevenueTotal: number;
    discounts: number;
    netRevenue: number;
    operatingExpenses: number;
    operatingProfit: number;
    netProfit: number;
    operatingMarginPercent: number;
    netMarginPercent: number;
    expensesByCategory: Array<{
      category: string;
      label: string;
      amount: number;
      percentage: number;
      count: number;
    }>;
  };
  topClients: Array<{
    id: string;
    name: string;
    billingType: string;
    totalPaid: number;
    totalPending: number;
    cleaningsCount: number;
    percentOfTotal: number;
  }>;
  cashFlowSeries: Array<{
    label: string;
    subLabel: string;
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    label: string;
    amount: number;
    percentage: number;
    count: number;
  }>;
  transactions: Array<{
    id: string;
    type: "INCOME" | "EXPENSE";
    date: string;
    description: string;
    clientName?: string;
    category: string;
    amount: number;
    paymentMethod?: string;
    status?: string;
  }>;
}

const CATEGORY_ICONS: Record<string, any> = {
  FUEL: Fuel,
  CLEANING_SUPPLIES: Sparkles,
  VEHICLE_MAINTENANCE: Wrench,
  EQUIPMENT: ShoppingBag,
  MEALS: Utensils,
  OTHER: Layers,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  FUEL: { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
  CLEANING_SUPPLIES: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
  VEHICLE_MAINTENANCE: { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" },
  EQUIPMENT: { bg: "bg-purple-50", text: "text-purple-700", bar: "bg-purple-500" },
  MEALS: { bg: "bg-orange-50", text: "text-orange-700", bar: "bg-orange-500" },
  OTHER: { bg: "bg-slate-100", text: "text-slate-700", bar: "bg-slate-500" },
};

export default function FinancialDashboardPage() {
  const [period, setPeriod] = useState<FinancialPeriod>("month");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "dre" | "clients" | "transactions">("overview");

  // Quick expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState("FUEL");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState<number | "">(50);
  const [expenseRecurrence, setExpenseRecurrence] = useState("ONE_TIME");
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState("");

  const fetchData = async (selectedPeriod: FinancialPeriod) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/financial/dashboard?period=${selectedPeriod}&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error("Erro ao carregar dados financeiros:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(period);
  }, [period]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDescription.trim()) {
      setExpenseError("Informe uma descrição para a despesa.");
      return;
    }
    if (!expenseAmount || Number(expenseAmount) <= 0) {
      setExpenseError("Informe um valor válido.");
      return;
    }

    setSavingExpense(true);
    setExpenseError("");
    try {
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expenseCategory,
          description: expenseDescription.trim(),
          amount: Number(expenseAmount),
          recurrence: expenseRecurrence,
          date: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setShowExpenseModal(false);
        setExpenseDescription("");
        setExpenseAmount(50);
        setExpenseRecurrence("ONE_TIME");
        fetchData(period);
      } else {
        const json = await res.json();
        setExpenseError(json.error || "Erro ao salvar despesa.");
      }
    } catch {
      setExpenseError("Falha na comunicação com o servidor.");
    } finally {
      setSavingExpense(false);
    }
  };

  // Max value for cash flow chart scaling
  const maxFlowVal = useMemo(() => {
    if (!data?.cashFlowSeries?.length) return 1;
    return (
      Math.max(
        ...data.cashFlowSeries.map((s) => Math.max(s.revenue, s.expenses, s.profit)),
        1000
      ) * 1.15
    );
  }, [data]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header />

      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100/80">
                <Landmark className="w-5 h-5 text-indigo-600" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Dashboard Financeiro
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                Tempo Real
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Gestão de faturamento, fluxo de caixa, DRE gerencial e margem operacional da empresa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period selector */}
            <div className="inline-flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
              {[
                { id: "month", label: "Mês Atual" },
                { id: "last_month", label: "Mês Anterior" },
                { id: "quarter", label: "3 Meses" },
                { id: "year", label: "Ano 2026" },
                { id: "all", label: "Tudo" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id as FinancialPeriod)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    period === p.id
                      ? "bg-white text-indigo-700 shadow-xs border border-indigo-100"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <button
              onClick={() => fetchData(period)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>

            <button
              onClick={() => setShowExpenseModal(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-rose-200 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Despesa</span>
            </button>

            <Link
              href="/payments"
              className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 border border-indigo-200/70 transition-all"
            >
              <Wallet className="w-4 h-4" />
              <span>Pagamentos</span>
            </Link>

            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer hidden sm:flex"
              title="Imprimir relatório financeiro"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="p-12 rounded-3xl bg-white border border-slate-200 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Calculando demonstrativos financeiros...</p>
          </div>
        )}

        {data && (
          <>
            {/* 4 Caixas Principais de Faturamento & Finanças (Transpostas do Dashboard) */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Recebido (Pago) */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Recebido (Pago)
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    ${data.kpis.totalReceived.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {data.kpis.grossRevenue.value > 0
                      ? `${(
                          (data.kpis.totalReceived.value / data.kpis.grossRevenue.value) *
                          100
                        ).toFixed(0)}% liquidado em caixa`
                      : "100% liquidado"}
                  </div>
                </motion.div>

                {/* 2. Pendente / A Receber */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Pendente / A Receber
                    </span>
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    ${data.kpis.totalPending.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {data.kpis.totalPending.overdueAmount > 0 ? (
                      <span className="text-rose-600 font-bold">
                        ${data.kpis.totalPending.overdueAmount.toFixed(0)} em atraso
                      </span>
                    ) : (
                      <span>Sem atrasos críticos</span>
                    )}
                  </div>
                </motion.div>

                {/* 3. Despesas Operacionais */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Despesas Operacionais
                    </span>
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                      <Fuel className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    ${data.kpis.totalExpenses.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {data.dre.expensesByCategory[0]
                      ? `Maior: ${data.dre.expensesByCategory[0].label.split("/")[0]}`
                      : "Sem despesas no período"}
                  </div>
                </motion.div>

                {/* 4. Lucro Real Líquido */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Lucro Real Líquido
                    </span>
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    ${data.kpis.netProfit.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px]">
                    <span className="font-bold text-indigo-600">
                      {data.kpis.profitMargin.value.toFixed(1)}%
                    </span>{" "}
                    <span className="text-slate-500">margem líquida</span>
                  </div>
                </motion.div>
              </div>

              {/* 2 Caixas Complementares: Faturamento Total & Base da Agenda */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Faturamento Bruto Total
                    </span>
                    <div className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                      ${data.kpis.grossRevenue.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right text-[11px]">
                    {data.kpis.grossRevenue.growthPercent !== null ? (
                      <span
                        className={`inline-flex items-center gap-0.5 font-bold ${
                          data.kpis.grossRevenue.isPositive ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {data.kpis.grossRevenue.isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {data.kpis.grossRevenue.growthPercent > 0 ? "+" : ""}
                        {data.kpis.grossRevenue.growthPercent}%
                      </span>
                    ) : null}
                    <div className="text-slate-400 text-[10px]">vs período anterior</div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total Previsto na Agenda
                    </span>
                    <div className="text-xl font-black text-indigo-700 tracking-tight mt-0.5">
                      ${data.kpis.agendaTotal.value.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <span className="font-bold text-slate-700">{data.kpis.agendaTotal.count}</span> atendimentos
                    <div className="text-slate-400 text-[10px]">previstos no calendário</div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
              {[
                { id: "overview", label: "Gráficos & Fluxo de Caixa", icon: BarChart3 },
                { id: "dre", label: "DRE Gerencial Completa", icon: FileText },
                { id: "clients", label: "Top Clientes por Receita", icon: Users },
                { id: "transactions", label: "Extrato de Movimentações", icon: Receipt },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 pb-3 transition-colors cursor-pointer border-b-2 -mb-[2px] ${
                      active
                        ? "text-indigo-600 border-indigo-600"
                        : "text-slate-500 border-transparent hover:text-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: OVERVIEW & GRÁFICOS */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Gráfico 1: Fluxo de Caixa Mensal (2 Colunas) */}
                  <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-indigo-600" />
                          <span>Evolução Mensal do Fluxo de Caixa (Últimos 6 Meses)</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Comparativo de Entradas (Receita), Saídas (Despesas) e Lucro Líquido
                        </p>
                      </div>

                      {/* Legenda */}
                      <div className="flex items-center gap-3 text-[11px] font-semibold">
                        <span className="flex items-center gap-1.5 text-emerald-700">
                          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                          Receita
                        </span>
                        <span className="flex items-center gap-1.5 text-rose-700">
                          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                          Despesas
                        </span>
                        <span className="flex items-center gap-1.5 text-indigo-700">
                          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                          Lucro
                        </span>
                      </div>
                    </div>

                    {/* Bars Display */}
                    <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2">
                      {data.cashFlowSeries.map((s, idx) => {
                        const revHeight = Math.max(8, (s.revenue / maxFlowVal) * 100);
                        const expHeight = Math.max(8, (s.expenses / maxFlowVal) * 100);
                        const profitHeight = Math.max(6, (Math.max(0, s.profit) / maxFlowVal) * 100);

                        return (
                          <div key={s.label} className="flex-1 flex flex-col items-center h-full justify-end group">
                            {/* Bars Group */}
                            <div className="w-full max-w-[56px] flex items-end justify-center gap-1.5 h-full relative">
                              {/* Receita */}
                              <div
                                style={{ height: `${revHeight}%` }}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-t-md transition-all shadow-xs relative"
                                title={`Receita: $${s.revenue.toFixed(0)}`}
                              />
                              {/* Despesas */}
                              <div
                                style={{ height: `${expHeight}%` }}
                                className="flex-1 bg-rose-400 hover:bg-rose-500 rounded-t-md transition-all shadow-xs"
                                title={`Despesas: $${s.expenses.toFixed(0)}`}
                              />
                              {/* Lucro */}
                              <div
                                style={{ height: `${profitHeight}%` }}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-t-md transition-all shadow-xs"
                                title={`Lucro: $${s.profit.toFixed(0)} (${s.margin}%)`}
                              />
                            </div>

                            {/* Label */}
                            <div className="mt-3 text-center">
                              <span className="text-[11px] font-bold text-slate-700 block">{s.label}</span>
                              <span className="text-[10px] text-indigo-600 font-bold block">
                                ${s.profit.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gráfico 2: Composição de Despesas por Categoria */}
                  <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-5">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                        <Fuel className="w-4 h-4 text-rose-600" />
                        <span>Composição de Despesas</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Distribuição percentual dos gastos no período
                      </p>
                    </div>

                    {data.expensesByCategory.length === 0 ? (
                      <p className="text-xs text-slate-400 py-8 text-center">
                        Nenhuma despesa lançada neste período.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {data.expensesByCategory.map((cat) => {
                          const Icon = CATEGORY_ICONS[cat.category] || Layers;
                          const color = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.OTHER;

                          return (
                            <div key={cat.category} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <Icon className={`w-3.5 h-3.5 ${color.text}`} />
                                  <span>{cat.label}</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">${cat.amount.toFixed(2)}</span>
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    ({cat.percentage.toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${Math.min(100, Math.max(3, cat.percentage))}%` }}
                                  className={`h-full ${color.bar} rounded-full transition-all`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Resumo Rápido da Eficiência Financeira */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100/90 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800 shrink-0">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                        Margem Líquida Real
                      </span>
                      <h4 className="text-xl font-black text-emerald-950">
                        {data.kpis.profitMargin.value.toFixed(1)}%
                      </h4>
                      <p className="text-xs text-emerald-800/80">
                        {data.kpis.profitMargin.value >= 30
                          ? "Saudável (acima do benchmark de 30% para serviços)"
                          : "Atenção: margem abaixo do ideal para o setor"}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100/90 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-800 shrink-0">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">
                        Ticket Médio por Limpeza
                      </span>
                      <h4 className="text-xl font-black text-indigo-950">
                        ${data.kpis.averageTicket.value.toFixed(2)}
                      </h4>
                      <p className="text-xs text-indigo-800/80">
                        Média de {data.kpis.averageTicket.cleaningsCount} atendimentos concluídos
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-100/90 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-amber-100 text-amber-800 shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                        Inadimplência / Pendências
                      </span>
                      <h4 className="text-xl font-black text-amber-950">
                        ${data.kpis.totalPending.value.toFixed(2)}
                      </h4>
                      <p className="text-xs text-amber-800/80">
                        {data.kpis.totalPending.overdueAmount > 0
                          ? `$${data.kpis.totalPending.overdueAmount.toFixed(0)} vencidos que requerem cobrança`
                          : "Nenhum valor em atraso crítico"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DRE GERENCIAL COMPLETA */}
            {activeTab === "dre" && (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-black text-slate-900 text-base">
                      Demonstrativo de Resultado do Exercício (DRE Gerencial)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Estrutura contábil executiva detalhando receitas, deduções operacionais e resultado líquido.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Linha de Resultado</th>
                        <th className="py-3 px-4 text-right">Valor no Período</th>
                        <th className="py-3 px-4 text-right">% da Receita</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {/* Receitas */}
                      <tr className="bg-emerald-50/50 font-bold text-emerald-950">
                        <td className="py-3 px-4 flex items-center gap-2">
                          <span className="text-emerald-700">(+)</span>
                          <span>RECEITA OPERACIONAL BRUTA DE SERVIÇOS</span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700">
                          ${data.dre.grossRevenueTotal.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700">100.0%</td>
                      </tr>
                      <tr className="text-slate-600 pl-8">
                        <td className="py-2.5 px-4 pl-8">• Atendimentos Diretos / Residenciais</td>
                        <td className="py-2.5 px-4 text-right">
                          ${data.dre.grossRevenueCleanings.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-400">
                          {data.dre.grossRevenueTotal > 0
                            ? `${((data.dre.grossRevenueCleanings / data.dre.grossRevenueTotal) * 100).toFixed(1)}%`
                            : "0%"}
                        </td>
                      </tr>
                      <tr className="text-slate-600 pl-8">
                        <td className="py-2.5 px-4 pl-8">• Faturas Comerciais Emitidas</td>
                        <td className="py-2.5 px-4 text-right">
                          ${data.dre.grossRevenueInvoices.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-400">
                          {data.dre.grossRevenueTotal > 0
                            ? `${((data.dre.grossRevenueInvoices / data.dre.grossRevenueTotal) * 100).toFixed(1)}%`
                            : "0%"}
                        </td>
                      </tr>

                      {/* Deduções */}
                      <tr className="text-slate-500">
                        <td className="py-3 px-4 flex items-center gap-2">
                          <span className="text-rose-600">(-)</span>
                          <span>Deduções e Descontos Concedidos</span>
                        </td>
                        <td className="py-3 px-4 text-right">$0.00</td>
                        <td className="py-3 px-4 text-right text-slate-400">0.0%</td>
                      </tr>

                      {/* Receita Líquida */}
                      <tr className="bg-slate-50 font-bold text-slate-900 border-t border-b border-slate-200">
                        <td className="py-3 px-4 flex items-center gap-2">
                          <span>(=)</span>
                          <span>RECEITA OPERACIONAL LÍQUIDA</span>
                        </td>
                        <td className="py-3 px-4 text-right font-black">
                          ${data.dre.netRevenue.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">100.0%</td>
                      </tr>

                      {/* Despesas */}
                      <tr className="bg-rose-50/50 font-bold text-rose-950">
                        <td className="py-3 px-4 flex items-center gap-2">
                          <span className="text-rose-700">(-)</span>
                          <span>CUSTOS E DESPESAS OPERACIONAIS</span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-rose-700">
                          -${data.dre.operatingExpenses.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-700">
                          {data.dre.netRevenue > 0
                            ? `${((data.dre.operatingExpenses / data.dre.netRevenue) * 100).toFixed(1)}%`
                            : "0%"}
                        </td>
                      </tr>

                      {data.dre.expensesByCategory.map((exp) => (
                        <tr key={exp.category} className="text-slate-600">
                          <td className="py-2 px-4 pl-8">• {exp.label} ({exp.count} lançamentos)</td>
                          <td className="py-2 px-4 text-right">-${exp.amount.toFixed(2)}</td>
                          <td className="py-2 px-4 text-right text-slate-400">
                            {data.dre.netRevenue > 0
                              ? `${((exp.amount / data.dre.netRevenue) * 100).toFixed(1)}%`
                              : "0%"}
                          </td>
                        </tr>
                      ))}

                      {/* Resultado Líquido */}
                      <tr className="bg-indigo-50 font-black text-indigo-950 text-sm border-t-2 border-indigo-200">
                        <td className="py-4 px-4 flex items-center gap-2">
                          <span className="text-indigo-600">(=)</span>
                          <span>RESULTADO LÍQUIDO DO EXERCÍCIO (LUCRO REAL)</span>
                        </td>
                        <td className="py-4 px-4 text-right text-base text-indigo-700 font-black">
                          ${data.dre.netProfit.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-right text-indigo-700 font-bold">
                          {data.dre.netMarginPercent.toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: TOP CLIENTES */}
            {activeTab === "clients" && (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      <span>Ranking dos Principais Clientes por Receita</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Clientes que mais geram faturamento no período selecionado
                    </p>
                  </div>
                  <Link
                    href="/clients"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <span>Ver todos clientes</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100">
                  {data.topClients.map((client, idx) => (
                    <div
                      key={client.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 rounded-xl px-3 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            idx === 0
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : idx === 1
                              ? "bg-slate-200 text-slate-800"
                              : idx === 2
                              ? "bg-amber-50 text-amber-900 border border-amber-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          #{idx + 1}
                        </div>
                        <div>
                          <Link
                            href={`/clients/${client.id}`}
                            className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors"
                          >
                            {client.name}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">
                              {client.cleaningsCount} atendimento(s)
                            </span>
                            <span>•</span>
                            <span className="text-slate-400">
                              {client.billingType === "INVOICE" ? "Fatura Formal" : "Por Limpeza"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 sm:text-right">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            Total Pago
                          </span>
                          <span className="font-black text-emerald-600 text-sm">
                            ${client.totalPaid.toFixed(2)}
                          </span>
                        </div>

                        {client.totalPending > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-amber-700 block uppercase">
                              Pendente
                            </span>
                            <span className="font-bold text-amber-600 text-sm">
                              ${client.totalPending.toFixed(2)}
                            </span>
                          </div>
                        )}

                        <div className="min-w-[70px]">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            Participação
                          </span>
                          <span className="font-bold text-indigo-700 text-xs">
                            {client.percentOfTotal.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: EXTRATO RECENTE */}
            {activeTab === "transactions" && (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-indigo-600" />
                      <span>Extrato Consolidado de Movimentações Financeiras</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Entradas de pagamentos recebidos e saídas operacionais registradas
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {data.transactions.map((tx) => {
                    const isIncome = tx.type === "INCOME";

                    return (
                      <div
                        key={tx.id}
                        className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isIncome ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {isIncome ? <DollarSign className="w-4 h-4" /> : <Fuel className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-xs truncate">
                              {tx.description}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>{new Date(tx.date).toLocaleDateString("pt-BR")}</span>
                              <span>•</span>
                              <span className="truncate">{tx.category}</span>
                              {tx.paymentMethod && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400">{tx.paymentMethod}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-black text-sm block ${
                              isIncome ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {isIncome ? "+" : "-"}${tx.amount.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{tx.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Quick New Expense Modal */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Lançar Nova Despesa</h3>
                </div>
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {expenseError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {expenseError}
                </div>
              )}

              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-indigo-600"
                  >
                    <option value="FUEL">Combustível / Gasolina</option>
                    <option value="CLEANING_SUPPLIES">Produtos de Limpeza</option>
                    <option value="VEHICLE_MAINTENANCE">Manutenção Veicular</option>
                    <option value="EQUIPMENT">Equipamentos / Maquinário</option>
                    <option value="MEALS">Alimentação em Campo</option>
                    <option value="OTHER">Outras Despesas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descrição</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Gasolina posto King Soopers"
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Valor (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Recorrência</label>
                    <select
                      value={expenseRecurrence}
                      onChange={(e) => setExpenseRecurrence(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-indigo-600"
                    >
                      <option value="ONE_TIME">Gasto Avulso</option>
                      <option value="WEEKLY">Semanal</option>
                      <option value="BI_WEEKLY">Quinzenal</option>
                      <option value="MONTHLY">Mensal</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingExpense}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-rose-200 cursor-pointer disabled:opacity-50"
                  >
                    {savingExpense ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Salvar Despesa</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
