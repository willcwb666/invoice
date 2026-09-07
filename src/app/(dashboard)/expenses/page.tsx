"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/dashboard/header";
import { Fuel, Wrench, Plus, Sparkles, Filter, DollarSign, ArrowUpRight } from "lucide-react";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [category, setCategory] = useState<"FUEL" | "CLEANING_SUPPLIES" | "VEHICLE_MAINTENANCE">("FUEL");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/expenses");
      if (res.ok) {
        const json = await res.json();
        setExpenses(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
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
        fetchExpenses();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const total = expenses.reduce((acc, exp) => acc + Number(exp.amount), 0);

  return (
    <div>
      <Header
        title="Despesas Operacionais"
        subtitle="Controle de custos para cálculo do lucro líquido real"
        onRefresh={fetchExpenses}
        loading={loading}
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
            <span className="text-slate-400 mr-2">Total de Despesas Acumulado:</span>
            <span className="font-bold text-rose-400 text-base font-mono">
              -${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Despesa</span>
          </button>
        </div>

        <div className="space-y-3">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                  {exp.category === "FUEL" ? <Fuel className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">{exp.description}</h4>
                  <p className="text-[11px] text-slate-400">
                    {exp.category} • {new Date(exp.date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-rose-400 text-sm font-mono">
                  -${Number(exp.amount).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-white text-base">Registrar Nova Despesa</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Categoria *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="FUEL">Gasolina / Combustível</option>
                  <option value="CLEANING_SUPPLIES">Produtos de Limpeza</option>
                  <option value="VEHICLE_MAINTENANCE">Manutenção Veicular</option>
                  <option value="EQUIPMENT">Equipamentos</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Descrição *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Combustível posto Shell"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Valor ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold"
                >
                  {submitting ? "Salvando..." : "Salvar Despesa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
