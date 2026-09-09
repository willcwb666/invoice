"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/dashboard/header";
import { CheckCircle2, Circle, AlertCircle, DollarSign, Wallet } from "lucide-react";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ totalPaid: number; totalUnpaid: number; count: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [clientFilter, setClientFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/v1/payments?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPayments(json.data || []);
        setSummary(json.summary || null);
      }
    } catch (e) {
      console.error("Erro ao buscar pagamentos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleStatusFilterChange = (next: "unpaid" | "paid" | "all") => {
    setStatusFilter(next);
    setSelectedIds([]);
  };

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    payments.forEach((p) => {
      if (p.client) map.set(p.client.id, p.client.name);
    });
    return Array.from(map.entries());
  }, [payments]);

  const filtered = useMemo(() => {
    return clientFilter === "all" ? payments : payments.filter((p) => p.client?.id === clientFilter);
  }, [payments, clientFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { client: any; items: any[] }>();
    for (const p of filtered) {
      const key = p.client?.id || "sem-cliente";
      if (!map.has(key)) map.set(key, { client: p.client, items: [] });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.values());
  }, [filtered]);

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isOverdue = (appt: any) => !appt.paid && new Date(appt.date) < startOfToday;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectGroup = (items: any[]) => {
    const ids = items.filter((i) => !i.paid).map((i) => i.id);
    const allSelected = ids.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    );
  };

  const markPaid = async (id: string) => {
    setProcessing(true);
    try {
      await fetch(`/api/v1/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid" }),
      });
      await fetchPayments();
    } finally {
      setProcessing(false);
    }
  };

  const markUnpaid = async (id: string) => {
    setProcessing(true);
    try {
      await fetch(`/api/v1/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_unpaid" }),
      });
      await fetchPayments();
    } finally {
      setProcessing(false);
    }
  };

  const markSelectedPaid = async () => {
    if (selectedIds.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/v1/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentIds: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        await fetchPayments();
      }
    } finally {
      setProcessing(false);
    }
  };

  const selectedTotal = filtered
    .filter((p) => selectedIds.includes(p.id))
    .reduce((acc, p) => acc + Number(p.price), 0);

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Pagamentos"
        subtitle="Controle de quais limpezas já foram pagas pelo cliente, fora do fluxo de faturas"
        onRefresh={fetchPayments}
        loading={loading}
      />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
              <span>Recebido (no filtro)</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-2 font-mono">
              ${(summary?.totalPaid || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-amber-600 text-xs font-semibold">
              <span>A Receber (no filtro)</span>
              <AlertCircle className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-amber-600 mt-2 font-mono">
              ${(summary?.totalUnpaid || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Atendimentos no filtro</span>
              <Wallet className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{summary?.count || 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(["unpaid", "paid", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusFilterChange(s)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === s
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s === "unpaid" ? "Pendentes" : s === "paid" ? "Pagos" : "Todos"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os clientes</option>
              {clients.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={markSelectedPaid}
                disabled={processing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Marcar {selectedIds.length} como Pago (${selectedTotal.toFixed(2)})
              </button>
            )}
          </div>
        </div>

        {/* Grouped list by client */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Carregando pagamentos...
          </div>
        ) : grouped.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Nenhum atendimento encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ client, items }) => {
              const unpaidIds = items.filter((i) => !i.paid).map((i) => i.id);
              const allSelected =
                unpaidIds.length > 0 && unpaidIds.every((id) => selectedIds.includes(id));
              const groupTotal = items.reduce((acc, i) => acc + Number(i.price), 0);
              const groupUnpaid = items
                .filter((i) => !i.paid)
                .reduce((acc, i) => acc + Number(i.price), 0);

              return (
                <div
                  key={client?.id || "sem-cliente"}
                  className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden"
                >
                  <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60">
                    <div className="flex items-center gap-2.5">
                      {unpaidIds.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleSelectGroup(items)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      )}
                      <h3 className="font-bold text-slate-900 text-sm">
                        {client?.name || "Sem cliente"}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {client?.billingType === "CONSOLIDATED_MONTHLY"
                          ? "Acerto mensal"
                          : "Paga por atendimento"}
                      </span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500">Total: </span>
                      <span className="font-mono font-bold text-slate-900">
                        ${groupTotal.toFixed(2)}
                      </span>
                      {groupUnpaid > 0 && (
                        <span className="ml-2 text-amber-600 font-mono font-bold">
                          (${groupUnpaid.toFixed(2)} pendente)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {items.map((appt) => (
                      <div
                        key={appt.id}
                        className="px-5 py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {!appt.paid && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(appt.id)}
                              onChange={() => toggleSelect(appt.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{appt.title}</p>
                            <p className="text-slate-500 font-mono text-[11px] flex items-center gap-1.5">
                              {new Date(appt.date).toLocaleDateString("pt-BR")}
                              {isOverdue(appt) && (
                                <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold uppercase">
                                  Atrasado
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <span className="font-mono font-bold text-slate-900 shrink-0">
                          ${Number(appt.price).toFixed(2)}
                        </span>

                        {appt.paid ? (
                          <button
                            type="button"
                            onClick={() => markUnpaid(appt.id)}
                            disabled={processing}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] shrink-0 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Pago
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => markPaid(appt.id)}
                            disabled={processing}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-slate-600 border border-slate-200 font-bold text-[11px] shrink-0 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                          >
                            <Circle className="w-3.5 h-3.5" />
                            Marcar Pago
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
