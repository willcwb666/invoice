"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/dashboard/header";
import {
  Fuel,
  Wrench,
  Plus,
  DollarSign,
  X,
  Search,
  Sparkles,
  ShoppingBag,
  Utensils,
  Layers,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORY_MAP: Record<
  string,
  { label: string; icon: any; color: string; bgColor: string; borderColor: string }
> = {
  FUEL: {
    label: "Combustível / Gasolina",
    icon: Fuel,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  CLEANING_SUPPLIES: {
    label: "Produtos de Limpeza",
    icon: Sparkles,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  VEHICLE_MAINTENANCE: {
    label: "Manutenção Veicular",
    icon: Wrench,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  EQUIPMENT: {
    label: "Equipamentos / Maquinário",
    icon: ShoppingBag,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  MEALS: {
    label: "Alimentação em Campo",
    icon: Utensils,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  OTHER: {
    label: "Outras Despesas",
    icon: Layers,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
};

const RECURRENCE_MAP: Record<
  string,
  { label: string; badgeColor: string }
> = {
  ONE_TIME: {
    label: "Avulsa",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
  },
  WEEKLY: {
    label: "Semanal",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  BI_WEEKLY: {
    label: "Quinzenal",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  MONTHLY: {
    label: "Mensal",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedRecurrence, setSelectedRecurrence] = useState("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current_month");

  // Month Definitions
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0 = Jan ... 9 = Outubro
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const currentMonthName = MONTH_NAMES[currentMonth];
  const prevMonthName = MONTH_NAMES[prevMonth];

  const selectedPeriodLabel = useMemo(() => {
    if (selectedPeriod === "current_month") {
      return `Mês Atual (${currentMonthName} ${currentYear})`;
    }
    if (selectedPeriod === "last_month") {
      return `Mês Anterior (${prevMonthName} ${prevYear})`;
    }
    if (selectedPeriod === "all") {
      return "Todo o Histórico (Todos os Meses)";
    }
    if (selectedPeriod.includes("-")) {
      const [y, m] = selectedPeriod.split("-").map(Number);
      return `${MONTH_NAMES[m - 1]} de ${y}`;
    }
    return "Filtrado";
  }, [selectedPeriod, currentMonthName, currentYear, prevMonthName, prevYear, MONTH_NAMES]);

  // Months available for the select dropdown
  const availableMonthOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [];
    // Months of current year
    for (let m = 0; m < 12; m++) {
      const val = `${currentYear}-${String(m + 1).padStart(2, "0")}`;
      list.push({
        value: val,
        label: `${MONTH_NAMES[m]} ${currentYear}`,
      });
    }
    return list;
  }, [currentYear, MONTH_NAMES]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form
  const [category, setCategory] = useState<string>("FUEL");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(50);
  const [recurrence, setRecurrence] = useState<string>("ONE_TIME");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/expenses");
      if (res.ok) {
        const json = await res.json();
        setExpenses(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao carregar despesas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description,
          amount: Number(amount),
          recurrence,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setDescription("");
        setAmount(50);
        setRecurrence("ONE_TIME");
        fetchExpenses();
      } else {
        const json = await res.json();
        setFormError(json.error || "Erro ao salvar despesa.");
      }
    } catch (e: any) {
      setFormError(e.message || "Erro de conexão ao salvar despesa.");
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Filtro estrito por mês/período
  const filteredByPeriod = useMemo(() => {
    if (selectedPeriod === "all") return expenses;

    return expenses.filter((exp) => {
      const expDate = new Date(exp.date);
      const expYear = expDate.getFullYear();
      const expMonth = expDate.getMonth(); // 0-indexed

      if (selectedPeriod === "current_month") {
        return expYear === currentYear && expMonth === currentMonth;
      }
      if (selectedPeriod === "last_month") {
        return expYear === prevYear && expMonth === prevMonth;
      }
      if (selectedPeriod.includes("-")) {
        const [targetYear, targetMonth] = selectedPeriod.split("-").map(Number);
        return expYear === targetYear && expMonth === targetMonth - 1;
      }
      return true;
    });
  }, [expenses, selectedPeriod, currentYear, currentMonth, prevYear, prevMonth]);

  // 2. Statistics calculadas ESTRITAMENTE para o período selecionado
  const totalAmount = useMemo(
    () => filteredByPeriod.reduce((acc, exp) => acc + Number(exp.amount), 0),
    [filteredByPeriod]
  );
  const fuelTotal = useMemo(
    () =>
      filteredByPeriod
        .filter((e) => e.category === "FUEL")
        .reduce((acc, exp) => acc + Number(exp.amount), 0),
    [filteredByPeriod]
  );
  const suppliesTotal = useMemo(
    () =>
      filteredByPeriod
        .filter((e) => e.category === "CLEANING_SUPPLIES")
        .reduce((acc, exp) => acc + Number(exp.amount), 0),
    [filteredByPeriod]
  );

  // 3. Filtros adicionais de busca, categoria e recorrência aplicados sobre o mês selecionado
  const filtered = useMemo(() => {
    return filteredByPeriod
      .filter((exp) => {
        const q = search.toLowerCase();
        const matchSearch =
          exp.description.toLowerCase().includes(q) ||
          exp.category.toLowerCase().includes(q);
        const matchCategory =
          selectedCategory === "ALL" || exp.category === selectedCategory;
        const matchRecurrence =
          selectedRecurrence === "ALL" ||
          (selectedRecurrence === "RECURRING"
            ? exp.recurrence && exp.recurrence !== "ONE_TIME"
            : (exp.recurrence || "ONE_TIME") === selectedRecurrence);
        return matchSearch && matchCategory && matchRecurrence;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredByPeriod, search, selectedCategory, selectedRecurrence]);

  const columns: ColumnDef<any>[] = [
    {
      key: "category",
      header: "Categoria",
      sortable: true,
      render: (exp) => {
        const cat = CATEGORY_MAP[exp.category] || CATEGORY_MAP.OTHER;
        const Icon = cat.icon;
        return (
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${cat.bgColor} ${cat.color} border ${cat.borderColor} shrink-0`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800 text-xs">{cat.label}</span>
          </div>
        );
      },
      sortValue: (exp) => exp.category,
    },
    {
      key: "description",
      header: "Descrição do Gasto",
      sortable: true,
      render: (exp) => (
        <span className="font-medium text-slate-900 text-xs">{exp.description}</span>
      ),
      sortValue: (exp) => exp.description,
    },
    {
      key: "recurrence",
      header: "Frequência",
      sortable: true,
      render: (exp) => {
        const rec = RECURRENCE_MAP[exp.recurrence || "ONE_TIME"] || RECURRENCE_MAP.ONE_TIME;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${rec.badgeColor}`}
          >
            {rec.label}
          </span>
        );
      },
      sortValue: (exp) => exp.recurrence || "ONE_TIME",
    },
    {
      key: "date",
      header: "Data",
      sortable: true,
      render: (exp) => (
        <span className="text-slate-600 text-[11px]">
          {new Date(exp.date).toLocaleDateString("pt-BR")}
        </span>
      ),
      sortValue: (exp) => new Date(exp.date),
    },
    {
      key: "amount",
      header: "Valor ($)",
      sortable: true,
      className: "text-right",
      render: (exp) => (
        <span className="font-bold text-rose-600 text-xs block text-right">
          -${Number(exp.amount).toFixed(2)}
        </span>
      ),
      sortValue: (exp) => Number(exp.amount),
    },
  ];

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Despesas Operacionais"
        subtitle="Controle de custos (gasolina, insumos, manutenção) para lucro líquido real"
        onRefresh={fetchExpenses}
        loading={loading}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Seletor de Mês e Período */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100/80">
              <Calendar className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Filtrar por Mês
              </span>
              <h3 className="text-xs font-bold text-slate-900">
                {selectedPeriodLabel}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setSelectedPeriod("current_month");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedPeriod === "current_month"
                    ? "bg-white text-indigo-700 shadow-xs border border-indigo-100"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mês Atual ({currentMonthName})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPeriod("last_month");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedPeriod === "last_month"
                    ? "bg-white text-indigo-700 shadow-xs border border-indigo-100"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mês Anterior ({prevMonthName})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPeriod("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedPeriod === "all"
                    ? "bg-white text-indigo-700 shadow-xs border border-indigo-100"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todos os Meses
              </button>
            </div>

            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="current_month">Mês Atual ({currentMonthName} {currentYear})</option>
              <option value="last_month">Mês Anterior ({prevMonthName} {prevYear})</option>
              {availableMonthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value="all">Todo o Histórico (Todos os Meses)</option>
            </select>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">
                Total de Despesas ({selectedPeriod === "all" ? "Acumulado" : selectedPeriodLabel.split("(")[0].trim()})
              </span>
              <span className="font-black text-rose-600 text-2xl tracking-tight">
                -${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">
                Combustível / Rotas
              </span>
              <span className="font-bold text-amber-700 text-xl tracking-tight">
                -${fuelTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
              <Fuel className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">
                Produtos de Limpeza
              </span>
              <span className="font-bold text-emerald-700 text-xl tracking-tight">
                -${suppliesTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter & Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar despesa ou categoria..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todas categorias</option>
              <option value="FUEL">Combustível</option>
              <option value="CLEANING_SUPPLIES">Produtos</option>
              <option value="VEHICLE_MAINTENANCE">Manutenção</option>
              <option value="EQUIPMENT">Equipamentos</option>
              <option value="MEALS">Alimentação</option>
              <option value="OTHER">Outros</option>
            </select>

            <select
              value={selectedRecurrence}
              onChange={(e) => {
                setSelectedRecurrence(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todas frequências</option>
              <option value="RECURRING">Todas recorrentes</option>
              <option value="MONTHLY">Mensal</option>
              <option value="BI_WEEKLY">Quinzenal</option>
              <option value="WEEKLY">Semanal</option>
              <option value="ONE_TIME">Avulsa</option>
            </select>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Despesa</span>
          </button>
        </div>

        {/* Standardized DataTable */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <DataTable
            columns={columns}
            data={filtered}
            currentPage={currentPage}
            pageSize={pageSize}
            defaultSortKey="date"
            defaultSortDir="desc"
            keyExtractor={(item) => item.id}
            emptyMessage={
              loading
                ? "Carregando despesas..."
                : "Nenhuma despesa encontrada com os filtros selecionados."
            }
          />
        </motion.div>

        {/* Reusable Pagination */}
        {filtered.length > 0 && (
          <Pagination
            totalItems={filtered.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => setPageSize(size)}
            pageSizeOptions={[10, 20, 30, 50, 100]}
          />
        )}
      </div>

      {/* Modal: Nova Despesa */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Registrar Nova Despesa</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Categoria *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs cursor-pointer"
                  >
                    <option value="FUEL">Gasolina / Combustível de Rota</option>
                    <option value="CLEANING_SUPPLIES">Produtos de Limpeza Profissionais</option>
                    <option value="VEHICLE_MAINTENANCE">Manutenção Veicular (Óleo, Pneus)</option>
                    <option value="EQUIPMENT">Equipamentos (Aspirador, Mops)</option>
                    <option value="MEALS">Alimentação em Horário de Trabalho</option>
                    <option value="OTHER">Outros Gastos Operacionais</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Descrição do Gasto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tanque cheio Posto Shell 8th Ave"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Valor em Dólares ($) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Frequência / Repetição da Despesa *
                  </label>
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs cursor-pointer"
                  >
                    <option value="ONE_TIME">Despesa Avulsa (Não se repete)</option>
                    <option value="MONTHLY">Mensal (Todo mês - Ex: aluguel de máquina, seguro)</option>
                    <option value="BI_WEEKLY">Quinzenal (A cada 15 dias)</option>
                    <option value="WEEKLY">Semanal (Toda semana)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Despesas mensais, semanais ou quinzenais se repetem no acompanhamento de custos.
                  </span>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <span>Salvar Despesa</span>
                    )}
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
