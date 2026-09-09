"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Receipt,
  Plus,
  Trash2,
  Calendar,
  User,
  UserPlus,
  FileText,
  DollarSign,
  AlertCircle,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";
import { ClientModal } from "@/components/ui/client-modal";

interface EstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdEstimate: any) => void;
}

interface EstimateItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

const PRESET_SERVICES = [
  { description: "House - Standard Regular Cleaning", price: 180 },
  { description: "House - Deep Cleaning / Move-Out", price: 350 },
  { description: "Office / Commercial Cleaning", price: 250 },
  { description: "Carpet & Upholstery Deep Steam", price: 150 },
];

export function EstimateModal({ isOpen, onClose, onSuccess }: EstimateModalProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [estimateNumber, setEstimateNumber] = useState("");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<EstimateItem[]>([
    { description: "House - Standard Regular Cleaning", quantity: 1, unitPrice: 180 },
  ]);
  const [notes, setNotes] = useState(
    "Orçamento válido por 15 dias. Inclui todos os produtos profissionais de limpeza e equipamentos. Não há taxas ocultas."
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/v1/clients");
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar clientes:", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchClients();
      setEstimateNumber(`EST-${Date.now().toString().slice(-4)}`);
    }
  }, [isOpen]);

  const addItem = (description = "", unitPrice = 100) => {
    setItems((prev) => {
      if (prev.length === 1 && !prev[0].description.trim() && description) {
        return [{ description, quantity: 1, unitPrice }];
      }
      return [...prev, { description, quantity: 1, unitPrice }];
    });
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof EstimateItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const totalAmount = items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedClientId) {
      setError("Selecione um cliente ou cadastre um novo na hora.");
      return;
    }

    if (items.some((it) => !it.description.trim() || it.unitPrice <= 0)) {
      setError("Todos os serviços precisam de descrição e valor positivo.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        clientId: selectedClientId,
        estimateNumber: estimateNumber.trim() || `EST-${Date.now().toString().slice(-4)}`,
        validUntil: `${validUntil}T23:59:59Z`,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
        })),
      };

      const res = await fetch("/api/v1/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Erro ao salvar orçamento.");
      }

      if (onSuccess) {
        onSuccess(json.data);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao criar orçamento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 my-8 space-y-6"
            >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Novo Orçamento (Estimate)</h3>
                  <p className="text-xs text-slate-500">
                    Crie orçamentos rápidos e converta em faturas em 1 clique
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Client Selection & Quick Add */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-700 font-semibold">Cliente *</label>
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Cadastrar Novo Cliente Agora</span>
                  </button>
                </div>

                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                >
                  <option value="">Selecione um cliente existente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.address ? `(${c.address})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estimate Number & Valid Until */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Número do Orçamento *
                  </label>
                  <input
                    type="text"
                    required
                    value={estimateNumber}
                    onChange={(e) => setEstimateNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Válido Até (Data de Expiração) *
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Adicionar serviços rápidos comuns:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SERVICES.map((p) => (
                    <button
                      key={p.description}
                      type="button"
                      onClick={() => addItem(p.description, p.price)}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200 transition-colors"
                    >
                      + {p.description.split(" - ")[1] || p.description} (${p.price})
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Itens e Serviços Orçados
                  </span>
                  <button
                    type="button"
                    onClick={() => addItem()}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Linha</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const lineTotal =
                      (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 text-xs"
                      >
                        <input
                          type="text"
                          required
                          placeholder="Descrição do serviço..."
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                        />

                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <input
                              type="number"
                              min="1"
                              placeholder="Qtd"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(idx, "quantity", Number(e.target.value))
                              }
                              className="w-full px-2 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-center font-mono focus:outline-none focus:border-indigo-500 shadow-2xs"
                            />
                          </div>

                          <div className="relative w-24">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                              $
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Preço"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateItem(idx, "unitPrice", Number(e.target.value))
                              }
                              className="w-full pl-6 pr-2 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 shadow-2xs"
                            />
                          </div>

                          <span className="w-20 text-right font-mono font-bold text-slate-900 block text-xs">
                            ${lineTotal.toFixed(2)}
                          </span>

                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="p-2 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total Preview */}
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 flex items-center justify-between text-xs">
                  <span className="text-amber-900 font-semibold">Valor Total do Orçamento:</span>
                  <span className="text-lg font-black font-mono text-slate-900">
                    ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-slate-700 font-semibold mb-1">
                  Notas / Termos do Orçamento
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando Orçamento...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Emitir Orçamento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Client Modal with higher z-index to overlay EstimateModal */}
      <ClientModal
        isOpen={isClientModalOpen}
        zIndex="z-[60]"
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={(newClient) => {
          fetchClients();
          if (newClient?.id) {
            setSelectedClientId(newClient.id);
          }
        }}
      />
    </>
  );
}
