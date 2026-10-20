"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { useToast } from "@/components/ui/toast";
import {
  Percent,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Award,
  CheckCircle2,
  Clock,
  Sliders,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  RotateCcw,
  Receipt,
  Loader2,
  Info,
} from "lucide-react";
import { zonedPartsFromUtc } from "@/lib/calendar/timezone";
import type {
  CleaningCommissionCategory,
  CommissionMode,
  ProfessionalRecord,
} from "@/services/professional-service";

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const CATEGORY_LABELS: Record<CleaningCommissionCategory, string> = {
  STANDARD: "Standard Cleaning",
  DEEP: "Deep Cleaning",
  MOVE_IN_OUT: "Move-In / Move-Out",
  CUSTOM: "Parcial / Outros",
};

function getDenverParts(isoOrDate: string | Date): {
  year: number;
  month: number;
  day: number;
  ymd: string;
} {
  const p = zonedPartsFromUtc(new Date(isoOrDate));
  const ymd = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { year: p.year, month: p.month - 1, day: p.day, ymd };
}

function resolveEffectiveCommissionRule(
  prof: ProfessionalRecord,
  category: CleaningCommissionCategory,
  jobYmd: string
): { mode: CommissionMode; value: number; effectiveFrom: string } {
  const history = prof.commissionHistory;
  if (Array.isArray(history) && history.length > 0) {
    const sorted = [...history].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom)
    );
    let activeEntry = sorted[0];
    for (const entry of sorted) {
      if (entry.effectiveFrom <= jobYmd) {
        activeEntry = entry;
      } else {
        break;
      }
    }
    const rule =
      activeEntry.commissions?.[category] ||
      activeEntry.commissions?.STANDARD || { mode: "PERCENTAGE", value: 0 };
    return {
      mode: rule.mode,
      value: Number(rule.value) || 0,
      effectiveFrom: activeEntry.effectiveFrom,
    };
  }

  const fallback =
    prof.commissions?.[category] ||
    prof.commissions?.STANDARD || { mode: "PERCENTAGE", value: 0 };
  return {
    mode: fallback.mode,
    value: Number(fallback.value) || 0,
    effectiveFrom: "2000-01-01",
  };
}

type SortKey =
  | "date"
  | "client"
  | "category"
  | "status"
  | "price"
  | "professionals"
  | "totalJobCommission";

export default function CommissionsPage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [launchingExpenseForId, setLaunchingExpenseForId] = useState<string | null>(null);

  // Month cursor (used when startDate & endDate are empty)
  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Advanced Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedProfFilter, setSelectedProfFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "SCHEDULED">("ALL");

  // Sorting state (Default: Data Decrescente)
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [apptsRes, profsRes] = await Promise.all([
        fetch(`/api/v1/appointments?t=${Date.now()}`, { cache: "no-store" }),
        fetch("/api/v1/professionals", { cache: "no-store" }),
      ]);
      if (apptsRes.ok) {
        const j = await apptsRes.json();
        setAppointments(j.data || []);
      }
      if (profsRes.ok) {
        const j = await profsRes.json();
        setProfessionals(j.data || []);
      }
    } catch (e) {
      console.error("Erro ao carregar dados de comissões:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const targetYear = cursorMonth.getFullYear();
  const targetMonth = cursorMonth.getMonth();
  const hasCustomDateRange = Boolean(startDate || endDate);

  // Lista única de clientes para o seletor de filtro
  const availableClients = useMemo(() => {
    const set = new Set<string>();
    for (const a of appointments) {
      if (a.status === "CANCELLED" || a.billable === false) continue;
      const cName = a.client?.name?.trim();
      if (cName) set.add(cName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [appointments]);

  // Filtra os atendimentos faturáveis conforme período, cliente, modalidade, profissional e status
  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return appointments.filter((a) => {
      if (a.status === "CANCELLED") return false;
      if (a.billable === false) return false;
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;

      const { year, month, ymd } = getDenverParts(a.startTime || a.date);

      if (hasCustomDateRange) {
        if (startDate && ymd < startDate) return false;
        if (endDate && ymd > endDate) return false;
      } else {
        if (year !== targetYear || month !== targetMonth) return false;
      }

      const category: CleaningCommissionCategory =
        (a.cleaningCategory as CleaningCommissionCategory) || "STANDARD";
      if (categoryFilter !== "ALL" && category !== categoryFilter) return false;

      const clientName = a.client?.name || "Cliente";
      if (clientFilter !== "ALL" && clientName !== clientFilter) return false;

      if (q) {
        const hay = `${clientName} ${a.title || ""} ${CATEGORY_LABELS[category] || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (selectedProfFilter !== "ALL") {
        const ids: string[] = Array.isArray(a.professionalIds)
          ? a.professionalIds
          : ["prof-willians", "prof-renata"];
        if (!ids.includes(selectedProfFilter)) return false;
      }

      return true;
    });
  }, [
    appointments,
    targetYear,
    targetMonth,
    hasCustomDateRange,
    startDate,
    endDate,
    categoryFilter,
    clientFilter,
    searchQuery,
    selectedProfFilter,
    statusFilter,
  ]);

  // Calcula comissão de cada trabalho por profissional respeitando a vigência histórica na data do evento
  const jobsWithCommissions = useMemo(() => {
    const mapped = filteredAppointments.map((appt) => {
      const price = Number(appt.price) || 0;
      const category: CleaningCommissionCategory =
        (appt.cleaningCategory as CleaningCommissionCategory) || "STANDARD";
      const { ymd } = getDenverParts(appt.startTime || appt.date);
      const profIds: string[] =
        Array.isArray(appt.professionalIds) && appt.professionalIds.length > 0
          ? appt.professionalIds
          : ["prof-willians", "prof-renata"];

      const breakdown = profIds
        .map((pid) => {
          const prof = professionals.find((p) => p.id === pid);
          if (!prof) return null;
          const rule = resolveEffectiveCommissionRule(prof, category, ymd);
          const amount =
            rule.mode === "FIXED"
              ? Math.max(0, Number(rule.value) || 0)
              : Math.max(0, (price * (Number(rule.value) || 0)) / 100);
          return {
            professionalId: prof.id,
            professionalName: prof.name,
            mode: rule.mode,
            ruleValue: rule.value,
            effectiveFrom: rule.effectiveFrom,
            commissionAmount: Math.round(amount * 100) / 100,
          };
        })
        .filter(Boolean) as {
        professionalId: string;
        professionalName: string;
        mode: "PERCENTAGE" | "FIXED";
        ruleValue: number;
        effectiveFrom: string;
        commissionAmount: number;
      }[];

      const totalJobCommission = breakdown.reduce((acc, b) => acc + b.commissionAmount, 0);

      return {
        ...appt,
        ymd,
        price,
        category,
        breakdown,
        totalJobCommission,
      };
    });

    // Ordenação dinâmica por coluna
    return [...mapped].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") {
        cmp =
          new Date(a.startTime || a.date).getTime() -
          new Date(b.startTime || b.date).getTime();
      } else if (sortKey === "client") {
        cmp = String(a.client?.name || "").localeCompare(
          String(b.client?.name || ""),
          undefined,
          { numeric: true }
        );
      } else if (sortKey === "category") {
        cmp = String(CATEGORY_LABELS[a.category as CleaningCommissionCategory] || "").localeCompare(
          String(CATEGORY_LABELS[b.category as CleaningCommissionCategory] || "")
        );
      } else if (sortKey === "status") {
        cmp = String(a.status || "").localeCompare(String(b.status || ""));
      } else if (sortKey === "price") {
        cmp = a.price - b.price;
      } else if (sortKey === "professionals") {
        const namesA = a.breakdown.map((x: any) => x.professionalName).join(", ");
        const namesB = b.breakdown.map((x: any) => x.professionalName).join(", ");
        cmp = namesA.localeCompare(namesB);
      } else if (sortKey === "totalJobCommission") {
        cmp = a.totalJobCommission - b.totalJobCommission;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredAppointments, professionals, sortKey, sortDir]);

  // Resumo por profissional no período filtrado
  const summaryByProfessional = useMemo(() => {
    return professionals.map((prof) => {
      let jobsCount = 0;
      let completedJobsCount = 0;
      let totalCommission = 0;
      let completedCommission = 0;
      let grossJobRevenue = 0;

      for (const job of jobsWithCommissions) {
        const entry = job.breakdown.find(
          (b: { professionalId: string; commissionAmount: number }) =>
            b.professionalId === prof.id
        );
        if (entry) {
          jobsCount += 1;
          grossJobRevenue += job.price;
          totalCommission += entry.commissionAmount;
          if (job.status === "COMPLETED") {
            completedJobsCount += 1;
            completedCommission += entry.commissionAmount;
          }
        }
      }

      return {
        prof,
        jobsCount,
        completedJobsCount,
        totalCommission: Math.round(totalCommission * 100) / 100,
        completedCommission: Math.round(completedCommission * 100) / 100,
        grossJobRevenue: Math.round(grossJobRevenue * 100) / 100,
      };
    });
  }, [professionals, jobsWithCommissions]);

  const totalGrossMonth = useMemo(
    () => jobsWithCommissions.reduce((acc, j) => acc + j.price, 0),
    [jobsWithCommissions]
  );

  const totalCommissionsMonth = useMemo(
    () =>
      jobsWithCommissions.reduce((acc, j) => {
        if (selectedProfFilter === "ALL") return acc + j.totalJobCommission;
        const found = j.breakdown.find(
          (b: { professionalId: string; commissionAmount: number }) =>
            b.professionalId === selectedProfFilter
        );
        return acc + (found?.commissionAmount || 0);
      }, 0),
    [jobsWithCommissions, selectedProfFilter]
  );

  const periodLabel = useMemo(() => {
    if (hasCustomDateRange) {
      const fromStr = startDate ? startDate.split("-").reverse().join("/") : "Início";
      const toStr = endDate ? endDate.split("-").reverse().join("/") : "Hoje";
      return `${fromStr} até ${toStr}`;
    }
    return `${MONTHS_PT[targetMonth]} ${targetYear}`;
  }, [hasCustomDateRange, startDate, endDate, targetMonth, targetYear]);

  const handleLaunchCommissionAsExpense = async (
    prof: ProfessionalRecord,
    amount: number
  ) => {
    if (amount <= 0) {
      showToast("O valor de comissão deste profissional no período é $0.00.", "error");
      return;
    }

    setLaunchingExpenseForId(prof.id);
    try {
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "OTHER",
          description: `Comissão Profissional: ${prof.name} (${periodLabel})`,
          amount: Number(amount.toFixed(2)),
          recurrence: "ONE_TIME",
          date: new Date().toISOString(),
          notes: `Repasse de comissões apuradas no módulo de Comissões referente a ${periodLabel}.`,
        }),
      });

      if (res.ok) {
        showToast(
          `Comissão de ${prof.name} ($${amount.toFixed(2)}) lançada em Despesas Operacionais!`,
          "success"
        );
      } else {
        const j = await res.json();
        showToast(j.error || "Não foi possível lançar a despesa.", "error");
      }
    } catch {
      showToast("Erro de conexão ao lançar despesa.", "error");
    } finally {
      setLaunchingExpenseForId(null);
    }
  };

  const clearAllFilters = () => {
    setStartDate("");
    setEndDate("");
    setClientFilter("ALL");
    setSearchQuery("");
    setCategoryFilter("ALL");
    setSelectedProfFilter("ALL");
    setStatusFilter("ALL");
    setSortKey("date");
    setSortDir("desc");
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
    );
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Módulo de Comissões"
        subtitle="Apuração instantânea de comissões (% ou valor fixo por modalidade) com preservação de vigência histórica"
        onRefresh={fetchData}
        loading={loading}
        actionSlot={
          <div className="flex items-center gap-2">
            <Link
              href="/expenses"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-all"
            >
              <Receipt className="w-3.5 h-3.5 text-rose-600" />
              <span>Ver Despesas</span>
            </Link>
            <Link
              href="/professionals"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configurar Regras de Comissão</span>
            </Link>
          </div>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Banner explicativo: Comissões vs Despesas + Preservação de Histórico */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-slate-700">
              <strong className="text-slate-900">Como funciona no Financeiro:</strong> As comissões
              são apuradas separadamente para controle de repasse e{" "}
              <strong className="text-indigo-900">
                não abatem automaticamente as Despesas Operacionais
              </strong>{" "}
              (assim testes ou pró-labore dos sócios não distorcem seu custo fixo). Quando pagar a
              comissão de um colaborador, basta clicar em{" "}
              <strong className="text-indigo-900">&ldquo;Lançar em Despesas&rdquo;</strong> no card
              do profissional.
            </div>
          </div>
        </div>

        {/* Toolbar Principal: Navegador de Mês + Filtros Avançados */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Seletor de Mês */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setCursorMonth(new Date(targetYear, targetMonth - 1, 1));
                }}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 min-w-[190px] text-center">
                <span className="text-sm font-black text-slate-900">{periodLabel}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setCursorMonth(new Date(targetYear, targetMonth + 1, 1));
                }}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  const now = new Date();
                  setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                }}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                Mês Atual
              </button>
            </div>

            {/* Filtro de Data Inicial e Final */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Período Personalizado:</span>
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Data Inicial"
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400 font-bold">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="Data Final"
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
              {(startDate ||
                endDate ||
                clientFilter !== "ALL" ||
                categoryFilter !== "ALL" ||
                selectedProfFilter !== "ALL" ||
                statusFilter !== "ALL" ||
                searchQuery) && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar Filtros</span>
                </button>
              )}
            </div>
          </div>

          {/* Linha 2 de Filtros: Busca, Cliente, Modalidade, Profissional, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Busca livre */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente ou serviço..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Filtro Cliente */}
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todos os Clientes ({availableClients.length})</option>
              {availableClients.map((cName) => (
                <option key={cName} value={cName}>
                  {cName}
                </option>
              ))}
            </select>

            {/* Filtro Modalidade */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todas as Modalidades</option>
              <option value="STANDARD">Standard Cleaning</option>
              <option value="DEEP">Deep Cleaning</option>
              <option value="MOVE_IN_OUT">Move-In / Move-Out</option>
              <option value="CUSTOM">Parcial / Outros</option>
            </select>

            {/* Filtro Profissional */}
            <select
              value={selectedProfFilter}
              onChange={(e) => setSelectedProfFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todos os Profissionais</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </select>

            {/* Filtro Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">Status: Agendados + Concluídos</option>
              <option value="COMPLETED">Somente Concluídos</option>
              <option value="SCHEDULED">Somente Agendados</option>
            </select>
          </div>
        </div>

        {/* Summary Cards per Professional */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {summaryByProfessional.map((item) => {
            const { prof, jobsCount, completedJobsCount, totalCommission, completedCommission } =
              item;
            const isLaunching = launchingExpenseForId === prof.id;

            return (
              <div
                key={prof.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-xs">
                      {prof.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900">{prof.name}</h3>
                      <p className="text-[11px] text-slate-500 font-semibold">{prof.role}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {jobsCount} limpeza(s)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      Comissão no Período
                    </span>
                    <span className="text-xl font-black text-emerald-700 mt-0.5 block">
                      ${totalCommission.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Já Realizado ({completedJobsCount})
                    </span>
                    <span className="text-xl font-black text-slate-900 mt-0.5 block">
                      ${completedCommission.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  {/* Mini summary of rules */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    {(["STANDARD", "DEEP", "MOVE_IN_OUT"] as CleaningCommissionCategory[]).map(
                      (cat) => {
                        const r = prof.commissions?.[cat];
                        if (!r) return null;
                        return (
                          <span
                            key={cat}
                            className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold"
                          >
                            {cat === "STANDARD" ? "Std" : cat === "DEEP" ? "Deep" : "Move"}:{" "}
                            {r.mode === "PERCENTAGE" ? `${r.value}%` : `$${r.value}`}
                          </span>
                        );
                      }
                    )}
                  </div>

                  {totalCommission > 0 && (
                    <button
                      type="button"
                      disabled={isLaunching}
                      onClick={() => handleLaunchCommissionAsExpense(prof, totalCommission)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      title="Lançar valor da comissão como Despesa Operacional no módulo de Despesas"
                    >
                      {isLaunching ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Receipt className="w-3 h-3" />
                      )}
                      <span>Lançar em Despesas</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Total Card */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-md flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Resumo Geral ({periodLabel})
              </span>
              <Award className="w-5 h-5 text-emerald-400" />
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">
                Total em Comissões Apuradas
              </span>
              <p className="text-3xl font-black text-emerald-400 mt-0.5">
                ${totalCommissionsMonth.toFixed(2)}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Faturamento dos Trabalhos ({jobsWithCommissions.length}):
              </span>
              <span className="font-black text-white">${totalGrossMonth.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Detailed Job-by-Job Commission Breakdown Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-black text-sm text-slate-900">
                Detalhamento de Comissões por Limpeza ({periodLabel})
              </h3>
              <p className="text-xs text-slate-500">
                Clique nos títulos das colunas (Data, Cliente, Modalidade, Valor) para alternar entre
                ordem crescente e decrescente
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {jobsWithCommissions.length} registro(s) listado(s)
            </span>
          </div>

          {jobsWithCommissions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Nenhum atendimento encontrado para este período/filtro.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-wider text-slate-600 select-none">
                    <th
                      onClick={() => handleSort("date")}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Data</span>
                        {renderSortIcon("date")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("client")}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Cliente & Trabalho</span>
                        {renderSortIcon("client")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("category")}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Modalidade</span>
                        {renderSortIcon("category")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("status")}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        {renderSortIcon("status")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("price")}
                      className="py-3.5 px-4 text-right cursor-pointer hover:text-indigo-600 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Valor Limpeza</span>
                        {renderSortIcon("price")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("professionals")}
                      className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Profissionais Escalados & Rateio</span>
                        {renderSortIcon("professionals")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("totalJobCommission")}
                      className="py-3.5 px-4 text-right cursor-pointer hover:text-indigo-600 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Total Comissão</span>
                        {renderSortIcon("totalJobCommission")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {jobsWithCommissions.map((job) => {
                    const d = new Date(job.startTime || job.date);
                    return (
                      <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-700 whitespace-nowrap">
                          {d.toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {job.client?.name || "Cliente"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[240px]">
                            {job.title}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {CATEGORY_LABELS[job.category as CleaningCommissionCategory] ||
                              "Standard Cleaning"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              job.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}
                          >
                            {job.status === "COMPLETED" ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Concluído</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>Agendado</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900">
                          ${job.price.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {job.breakdown.map(
                              (b: {
                                professionalId: string;
                                professionalName: string;
                                mode: "PERCENTAGE" | "FIXED";
                                ruleValue: number;
                                effectiveFrom: string;
                                commissionAmount: number;
                              }) => (
                                <span
                                  key={b.professionalId}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50/90 border border-indigo-200/80 text-indigo-950 text-[11px] font-bold"
                                  title={
                                    b.effectiveFrom > "2000-01-01"
                                      ? `Regra vigente desde ${b.effectiveFrom}`
                                      : "Regra base vigente na data do atendimento"
                                  }
                                >
                                  <span>{b.professionalName}:</span>
                                  <span className="text-[10px] text-indigo-600 font-semibold">
                                    ({b.mode === "PERCENTAGE" ? `${b.ruleValue}%` : `$${b.ruleValue} fixo`})
                                  </span>
                                  <span className="text-emerald-700 font-black">
                                    ${b.commissionAmount.toFixed(2)}
                                  </span>
                                </span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-emerald-700">
                          ${job.totalJobCommission.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
