"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wrench, DollarSign, Clock, Check, AlertCircle, Loader2 } from "lucide-react";

export interface ServiceRecord {
  id: string;
  name: string;
  description?: string | null;
  type: "STANDARD" | "EXTRA";
  basePrice: number | string;
  defaultDurationMinutes: number;
}

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  service?: ServiceRecord | null;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  type: "STANDARD" as "STANDARD" | "EXTRA",
  basePrice: "",
  defaultDurationMinutes: "120",
};

export function ServiceModal({ isOpen, onClose, onSuccess, service }: ServiceModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(service);

  useEffect(() => {
    if (isOpen) {
      setFormData(
        service
          ? {
              name: service.name,
              description: service.description || "",
              type: service.type,
              basePrice: String(service.basePrice),
              defaultDurationMinutes: String(service.defaultDurationMinutes),
            }
          : EMPTY_FORM
      );
      setError(null);
    }
  }, [isOpen, service]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const basePrice = Number(formData.basePrice);
    if (!formData.name.trim()) {
      setError("Informe o nome do serviço.");
      return;
    }
    if (!basePrice || basePrice <= 0) {
      setError("Informe um preço base válido.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        basePrice,
        defaultDurationMinutes: Number(formData.defaultDurationMinutes) || undefined,
      };

      const res = await fetch(
        isEditing ? `/api/v1/services/${service!.id}` : "/api/v1/services",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        if (json.details) {
          const firstErr = Object.values(json.details)[0];
          throw new Error(Array.isArray(firstErr) ? firstErr[0] : json.error || "Erro ao salvar serviço.");
        }
        throw new Error(json.error || "Erro ao salvar serviço.");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao salvar o serviço.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 my-8 space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isEditing ? "Editar Serviço" : "Novo Serviço"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cadastre o preço base usado nos agendamentos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome do Serviço *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Standard Cleaning, Fridge Cleaning..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs cursor-text"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descrição (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Detalhes do que está incluso neste serviço..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs resize-none cursor-text"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Tipo de Serviço *</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: "STANDARD" })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      formData.type === "STANDARD"
                        ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/30"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        formData.type === "STANDARD"
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {formData.type === "STANDARD" && <Check className="w-2.5 h-2.5" />}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Standard</span>
                      <span className="text-[11px] text-slate-500">Ex: Deep, Standard, Move-Out</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: "EXTRA" })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      formData.type === "EXTRA"
                        ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/30"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        formData.type === "EXTRA"
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {formData.type === "EXTRA" && <Check className="w-2.5 h-2.5" />}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Extra</span>
                      <span className="text-[11px] text-slate-500">Ex: Fridge, Oven Cleaning</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Price & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Preço Base ($) *</label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formData.basePrice}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs font-mono font-bold cursor-text"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Duração Padrão (min)</label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={formData.defaultDurationMinutes}
                      onChange={(e) =>
                        setFormData({ ...formData, defaultDurationMinutes: e.target.value })
                      }
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs font-mono cursor-text"
                    />
                  </div>
                </div>
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
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{isEditing ? "Salvar Alterações" : "Cadastrar Serviço"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
