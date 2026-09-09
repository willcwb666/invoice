"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UserPlus,
  MapPin,
  Phone,
  Mail,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdClient: any) => void;
  zIndex?: string;
}

export function ClientModal({ isOpen, onClose, onSuccess, zIndex = "z-50" }: ClientModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "Greeley",
    state: "CO",
    zipCode: "80634",
    billingType: "PER_JOB" as "PER_JOB" | "CONSOLIDATED_MONTHLY",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "Greeley",
      state: "CO",
      zipCode: "80634",
      billingType: "PER_JOB",
      notes: "",
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const fullAddress = formData.address.trim();
      if (!fullAddress) {
        throw new Error("Endereço é obrigatório para rota GPS e faturamento.");
      }

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: fullAddress,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || "CO",
        zipCode: formData.zipCode.trim() || undefined,
        billingType: formData.billingType,
        notes: formData.notes.trim() || undefined,
      };

      const res = await fetch("/api/v1/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.details) {
          const firstErr = Object.values(json.details)[0];
          throw new Error(Array.isArray(firstErr) ? firstErr[0] : json.error || "Erro ao salvar cliente.");
        }
        throw new Error(json.error || "Erro ao salvar cliente.");
      }

      resetForm();
      if (onSuccess) {
        onSuccess(json.data);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao cadastrar cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 my-8 space-y-6"
          >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Novo Cliente</h3>
                <p className="text-xs text-slate-500">
                  Cadastre dados completos para faturas, rota GPS e agenda
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
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

            {/* Basic Info */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Nome Completo / Família *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sarah Johnson ou Dr. Henderson Office"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Telefone (WhatsApp / SMS)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ex: (970) 555-0192"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    E-mail para Faturas
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="cliente@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address & GPS */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>Endereço para Navegação GPS (Apple & Google Maps)</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Logradouro & Número *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 2410 17th Ave ou 4172 MeadowView Way"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 sm:col-span-1">
                  <label className="block text-slate-700 font-semibold mb-1">Cidade</label>
                  <input
                    type="text"
                    placeholder="Greeley"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Estado</label>
                  <input
                    type="text"
                    placeholder="CO"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 uppercase font-mono focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Zip Code</label>
                  <input
                    type="text"
                    placeholder="80634"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Billing Type */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-slate-700 font-semibold mb-1">
                Tipo de Faturamento & Cobrança *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, billingType: "PER_JOB" })}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    formData.billingType === "PER_JOB"
                      ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/30"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      formData.billingType === "PER_JOB"
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {formData.billingType === "PER_JOB" && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Por Trabalho / Faxina</span>
                    <span className="text-[11px] text-slate-500">
                      Fatura emitida a cada limpeza avulsa
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, billingType: "CONSOLIDATED_MONTHLY" })}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    formData.billingType === "CONSOLIDATED_MONTHLY"
                      ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/30"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      formData.billingType === "CONSOLIDATED_MONTHLY"
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {formData.billingType === "CONSOLIDATED_MONTHLY" && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Consolidado Mensal</span>
                    <span className="text-[11px] text-slate-500">
                      Agrupa todas as limpezas do mês em 1 fatura
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-slate-700 font-semibold mb-1">
                Observações de Acesso & Detalhes
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Código da porta da garagem: 4821. Cão dócil no quintal. Limpar bem o vidro da sacada."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
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
                    <span>Salvando Cliente...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Cadastrar Cliente</span>
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
