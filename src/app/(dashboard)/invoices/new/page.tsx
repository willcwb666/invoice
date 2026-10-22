"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import {
  Plus,
  ArrowLeft,
  Trash2,
  Calendar,
  CheckCircle2,
  UserPlus,
  Sparkles,
  Loader2,
  DollarSign,
  PlusCircle,
  Tag,
} from "lucide-react";
import { ClientModal } from "@/components/ui/client-modal";

const PRESET_SERVICES = [
  { description: "House - Standard Regular Cleaning", price: 180 },
  { description: "House - Deep Cleaning / Move-Out", price: 350 },
  { description: "Office / Commercial Cleaning", price: 250 },
  { description: "Carpet & Upholstery Deep Steam", price: 150 },
];

interface AdjustmentItem {
  id: string;
  type: "CREDIT" | "DISCOUNT";
  description: string;
  amount: number | string;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-4)}`);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [items, setItems] = useState([
    { description: "House - Standard Regular Cleaning", quantity: 1, unitPrice: 180 },
  ]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // Dynamic adjustments (Crédito ou Desconto)
  const [enableAdjustments, setEnableAdjustments] = useState(false);
  const [adjustments, setAdjustments] = useState<AdjustmentItem[]>([
    { id: "adj-1", type: "CREDIT", description: "", amount: "" },
  ]);

  // null = not loaded yet for the current client (shows the loading state);
  // [] = loaded and this client simply has no uninvoiced completed jobs.
  const [uninvoicedAppointments, setUninvoicedAppointments] = useState<any[] | null>(null);
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<string[]>([]);
  const loadingAppointments = Boolean(selectedClientId) && uninvoicedAppointments === null;

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/v1/clients");
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Reload appointments when client changes
  useEffect(() => {
    if (!selectedClientId) return;
    fetch(`/api/v1/appointments?clientId=${selectedClientId}&uninvoiced=true`)
      .then((r) => r.json())
      .then((json) => setUninvoicedAppointments(json.data || []))
      .catch(() => setUninvoicedAppointments([]));
  }, [selectedClientId]);

  const handleClientChange = (id: string) => {
    setSelectedClientId(id);
    setSelectedAppointmentIds([]);
    setUninvoicedAppointments(id ? null : []);
  };

  const toggleAppointment = (id: string) => {
    setSelectedAppointmentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const addItem = (description = "", unitPrice = 100) => {
    setItems([...items, { description, quantity: 1, unitPrice }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const addAdjustment = () => {
    setAdjustments((prev) => [
      ...prev,
      { id: `adj-${Date.now()}-${Math.random()}`, type: "CREDIT", description: "", amount: "" },
    ]);
  };

  const removeAdjustment = (id: string) => {
    setAdjustments((prev) => {
      const remaining = prev.filter((a) => a.id !== id);
      return remaining.length > 0
        ? remaining
        : [{ id: `adj-${Date.now()}`, type: "CREDIT", description: "", amount: "" }];
    });
  };

  const updateAdjustment = (id: string, field: keyof AdjustmentItem, value: any) => {
    setAdjustments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const appointmentsTotal = (uninvoicedAppointments || [])
    .filter((a) => selectedAppointmentIds.includes(a.id))
    .reduce((acc, a) => acc + Number(a.price), 0);
  const itemsTotal = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  const activeAdjustments = enableAdjustments
    ? adjustments.filter((a) => a.description.trim() && Number(a.amount) > 0)
    : [];

  const creditsTotal = activeAdjustments
    .filter((a) => a.type === "CREDIT")
    .reduce((acc, a) => acc + Number(a.amount), 0);

  const discountsTotal = activeAdjustments
    .filter((a) => a.type === "DISCOUNT")
    .reduce((acc, a) => acc + Number(a.amount), 0);

  const subtotal = appointmentsTotal + itemsTotal + creditsTotal;
  const finalTotal = Math.max(0, subtotal - discountsTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (items.length === 0 && selectedAppointmentIds.length === 0 && activeAdjustments.length === 0) {
      setError("Adicione ao menos um item manual, agendamento concluído ou ajuste de valor.");
      return;
    }

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
          appointmentIds: selectedAppointmentIds,
          adjustments: activeAdjustments.map((a) => ({
            type: a.type,
            description: a.description.trim(),
            amount: Number(a.amount),
          })),
          discount: discountsTotal,
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
    <div className="bg-[#f8fafc] min-h-screen">
      <Header title="Nova Fatura" subtitle="Emita faturas avulsas ou consolidadas" />

      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <Link
          href="/invoices"
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Faturas</span>
        </Link>

        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6"
        >
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
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
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                <option value="">Selecione o cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.address ? `(${c.address})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Número da Fatura *</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono shadow-2xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Data de Vencimento *</label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 shadow-2xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Adicionar serviços rápidos comuns:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SERVICES.map((p) => (
                <button
                  key={p.description}
                  type="button"
                  onClick={() => addItem(p.description, p.price)}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200 transition-colors cursor-pointer"
                >
                  + {p.description.split(" - ")[1] || p.description} (${p.price})
                </button>
              ))}
            </div>
          </div>

          {/* Agendamentos concluídos ainda não faturados deste cliente */}
          {selectedClientId && (loadingAppointments || (uninvoicedAppointments?.length ?? 0) > 0) && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Serviços Concluídos Ainda Não Faturados
                </span>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Selecione para faturar automaticamente</span>
                </div>
              </div>

              {loadingAppointments ? (
                <p className="text-xs text-slate-400">Buscando agendamentos do cliente...</p>
              ) : (
                <div className="space-y-2">
                  {(uninvoicedAppointments || []).map((appt) => {
                    const checked = selectedAppointmentIds.includes(appt.id);
                    return (
                      <label
                        key={appt.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                          checked
                            ? "bg-indigo-50 border-indigo-300"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAppointment(appt.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{appt.title}</p>
                          <p className="text-slate-500 font-mono text-[11px]">
                            {new Date(appt.date).toLocaleDateString("en-US")}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          ${Number(appt.price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Itens Manuais da Fatura */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Itens e Serviços Manuais
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

            <div className="space-y-2.5">
              {items.map((item, idx) => (
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
                    <input
                      type="number"
                      min="1"
                      placeholder="Qtd"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                      className="w-16 px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-center font-mono shadow-2xs focus:outline-none focus:border-indigo-500"
                    />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Valor"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                        className="w-24 pl-6 pr-2 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono shadow-2xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-2 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seção Dinâmica de Acréscimos / Deduções (Créditos e Descontos) */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableAdjustments}
                  onChange={(e) => {
                    setEnableAdjustments(e.target.checked);
                    if (e.target.checked && adjustments.length === 0) {
                      addAdjustment();
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900">
                  Deseja adicionar valores extras (Crédito ou Desconto)?
                </span>
              </label>

              {enableAdjustments && (
                <button
                  type="button"
                  onClick={addAdjustment}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Adicionar outro valor</span>
                </button>
              )}
            </div>

            {enableAdjustments && (
              <div className="space-y-2.5 p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/80">
                <p className="text-[11px] text-amber-800 font-medium">
                  Lance acréscimos positivos (Crédito: deslocamento, produtos, etc.) ou deduções negativas (Desconto: cupom, pontualidade).
                </p>

                {adjustments.map((adj, idx) => (
                  <div
                    key={adj.id}
                    className="p-2.5 rounded-xl bg-white border border-amber-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs shadow-2xs"
                  >
                    {/* Campo se é Crédito ou Desconto */}
                    <div className="w-full sm:w-36">
                      <select
                        value={adj.type}
                        onChange={(e) => updateAdjustment(adj.id, "type", e.target.value)}
                        className={`w-full px-2.5 py-2 rounded-lg border font-bold text-xs cursor-pointer focus:outline-none ${
                          adj.type === "CREDIT"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-rose-50 text-rose-800 border-rose-300"
                        }`}
                      >
                        <option value="CREDIT">+ Crédito (Acréscimo)</option>
                        <option value="DISCOUNT">- Desconto (Dedução)</option>
                      </select>
                    </div>

                    {/* Descrição do ajuste */}
                    <input
                      type="text"
                      placeholder={
                        adj.type === "CREDIT"
                          ? "Ex: Taxa de deslocamento, produto extra..."
                          : "Ex: Desconto fidelidade, indicação..."
                      }
                      value={adj.description}
                      onChange={(e) => updateAdjustment(adj.id, "description", e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />

                    {/* Valor numérico */}
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={adj.amount}
                          onChange={(e) => updateAdjustment(adj.id, "amount", e.target.value)}
                          className="w-24 pl-6 pr-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Ícone + no final do campo para adicionar outro valor */}
                      <button
                        type="button"
                        onClick={addAdjustment}
                        title="Adicionar outro valor"
                        className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      {/* Botão de excluir linha */}
                      <button
                        type="button"
                        onClick={() => removeAdjustment(adj.id)}
                        title="Remover este ajuste"
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totais detalhados */}
            <div className="pt-3 border-t border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Serviços / Atendimentos:</span>
                <span className="font-mono font-semibold">
                  ${(appointmentsTotal + itemsTotal).toFixed(2)}
                </span>
              </div>

              {creditsTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>+ Acréscimos (Créditos adicionais):</span>
                  <span className="font-mono font-bold">+${creditsTotal.toFixed(2)}</span>
                </div>
              )}

              {discountsTotal > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>- Deduções (Descontos aplicados):</span>
                  <span className="font-mono font-bold">-${discountsTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-900">Valor Total da Fatura:</span>
                <span className="font-black text-indigo-600 text-2xl font-mono">
                  ${finalTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1 text-xs">
              Observações ou Mensagem Especial na Fatura
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Obrigado pela preferência! Pagamento via Zelle ou Venmo."
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Link
              href="/invoices"
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando Fatura...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Emitir Fatura Oficial</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Quick Add Client Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={(newClient) => {
          fetchClients();
          if (newClient?.id) {
            setSelectedClientId(newClient.id);
          }
        }}
      />
    </div>
  );
}
