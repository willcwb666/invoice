"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import { Plus, ArrowLeft, Trash2, Calendar, FileText, CheckCircle2 } from "lucide-react";

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-4)}`);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState([
    { description: "House - Standard cleaning", quantity: 1, unitPrice: 180 },
  ]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/clients")
      .then((r) => r.json())
      .then((json) => setClients(json.data || []));
  }, []);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 100 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
    }
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const total = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/v1/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          invoiceNumber,
          dueDate: new Date(`${dueDate}T23:59:59Z`).toISOString(),
          status: "PENDING",
          notes: notes || undefined,
          items: items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar fatura.");
      }

      router.push(`/invoices/${data.data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Header title="Nova Fatura" subtitle="Emita faturas avulsas ou consolidadas" />

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link
          href="/invoices"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Faturas</span>
        </Link>

        <form onSubmit={handleSubmit} className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-2xl space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Cliente *</label>
              <select
                required
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Selecione o cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.address})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Número da Fatura *</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Data de Vencimento *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
              />
            </div>
          </div>

          {/* Itens da Fatura */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Itens e Serviços</span>
              <button
                type="button"
                onClick={addItem}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
                  <input
                    type="text"
                    required
                    placeholder="Descrição do serviço..."
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qtd"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                      className="w-16 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-center"
                    />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Valor"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                        className="w-24 pl-6 pr-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-2 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-slate-700/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-right pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400 mr-2">Valor Total da Fatura:</span>
              <span className="font-bold text-white text-base font-mono">
                ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <Link
              href="/invoices"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {submitting ? "Gerando Fatura..." : "Emitir Fatura Oficial"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
