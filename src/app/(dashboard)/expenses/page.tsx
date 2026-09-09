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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form
  const [category, setCategory] = useState<string>("FUEL");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(50);
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
        body: JSON.stringify({ category, description, amount: Number(amount) }),
      });
      if (res.ok) {
        setShowModal(false);
        setDescription("");
        setAmount(50);
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

  // Filtered & Paginated
  const filtered = useMemo(() => {
    return expenses
      .filter((exp) => {
        const q = search.toLowerCase();
        const matchSearch =
          exp.description.toLowerCase().includes(q) ||
          exp.category.toLowerCase().includes(q);
        const matchCategory =
          selectedCategory === "ALL" || exp.category === selectedCategory;
        return matchSearch && matchCategory;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, search, selectedCategory]);



  // Statistics
  const totalAmount = useMemo(
    () => expenses.reduce((acc, exp) => acc + Number(exp.amount), 0),
    [expenses]
  );
  const fuelTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.category === "FUEL")
        .reduce((acc, exp) => acc + Number(exp.amount), 0),
    [expenses]
  );
  const suppliesTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.category === "CLEANING_SUPPLIES")
        .reduce((acc, exp) => acc + Number(exp.amount), 0),
    [expenses]
  );

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
      key: "date",
      header: "Data",
      sortable: true,
      render: (exp) => (
        <span className="font-mono text-slate-600 text-[11px]">
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
        <span className="font-mono font-bold text-rose-600 text-xs block text-right">
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
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">
                Total de Despesas Acumulado
              </span>
              <span className="font-mono font-black text-rose-600 text-2xl">
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
              <span className="font-mono font-bold text-amber-700 text-xl">
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
              <span className="font-mono font-bold text-emerald-700 text-xl">
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
