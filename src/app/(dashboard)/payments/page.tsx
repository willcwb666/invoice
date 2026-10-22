"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/dashboard/header";
import { Pagination } from "@/components/ui/pagination";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  DollarSign,
  Wallet,
  ArrowUpDown,
  Users,
  Calendar,
  X,
  RotateCcw,
} from "lucide-react";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ totalPaid: number; totalUnpaid: number; count: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
    setCurrentPage(1);
  };

  const handleClientFilterChange = (clientId: string) => {
    setClientFilter(clientId);
    setSelectedIds([]);
    setCurrentPage(1);
  };

  const handleSortChange = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setCurrentPage(1);
  };

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    payments.forEach((p) => {
      if (p.client) map.set(p.client.id, p.client.name);
    });
    return Array.from(map.entries());
  }, [payments]);

  // Filtered by client
  const clientFiltered = useMemo(() => {
    return clientFilter === "all" ? payments : payments.filter((p) => p.client?.id === clientFilter);
  }, [payments, clientFilter]);

  // Sorted by date (descending or ascending)
  const sortedPayments = useMemo(() => {
    const list = [...clientFiltered];
    list.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) {
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      }
      const startA = a.startTime || "";
      const startB = b.startTime || "";
      return sortOrder === "desc" ? startB.localeCompare(startA) : startA.localeCompare(startB);
    });
    return list;
  }, [clientFiltered, sortOrder]);

  // Grouped by client (preserving the sorted order of appearance)
  const grouped = useMemo(() => {
    const map = new Map<string, { client: any; items: any[] }>();
    for (const p of sortedPayments) {
      const key = p.client?.id || "sem-cliente";
      if (!map.has(key)) map.set(key, { client: p.client, items: [] });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.values());
  }, [sortedPayments]);

  // Paginated items
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return grouped.slice(start, start + pageSize);
  }, [grouped, currentPage, pageSize]);

  const paginatedFlat = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedPayments.slice(start, start + pageSize);
  }, [sortedPayments, currentPage, pageSize]);

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isOverdue = (appt: any) => !appt.paid && new Date(appt.date) < startOfToday;

  const paymentTextColor = (appt: any) =>
    appt.paid ? "text-emerald-600" : isOverdue(appt) ? "text-rose-600" : "text-amber-600";

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectGroup = (items: any[]) => {
    const ids = items.map((i) => i.id);
    const allSelected = ids.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    );
  };

  const selectAllVisible = () => {
    const visibleIds =
      viewMode === "grouped"
        ? paginatedGroups.flatMap((g) => g.items.map((i) => i.id))
        : paginatedFlat.map((i) => i.id);

    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
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

  const executeBulkAction = async (action: "PAID" | "UNPAID") => {
    if (selectedIds.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/v1/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentIds: selectedIds, action }),
      });
      if (res.ok) {
        setSelectedIds([]);
        await fetchPayments();
      }
    } finally {
      setProcessing(false);
    }
  };

  const selectedAppointments = useMemo(
    () => payments.filter((p) => selectedIds.includes(p.id)),
    [payments, selectedIds]
  );

  const selectedTotal = useMemo(
    () => selectedAppointments.reduce((acc, p) => acc + Number(p.price), 0),
    [selectedAppointments]
  );

  const selectedUnpaidCount = useMemo(
    () => selectedAppointments.filter((p) => !p.paid).length,
    [selectedAppointments]
  );

  const selectedPaidCount = useMemo(
    () => selectedAppointments.filter((p) => p.paid).length,
    [selectedAppointments]
  );

  const totalPaginationCount = viewMode === "grouped" ? grouped.length : sortedPayments.length;

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Pagamentos"
        subtitle="Controle de quais limpezas já foram pagas pelo cliente, fora do fluxo de faturas"
        onRefresh={fetchPayments}
        loading={loading}
      />

      <div className="p-3.5 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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

        {/* Filters and Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Status filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(
              [
                { id: "unpaid", label: "Pendentes" },
                { id: "paid", label: "Pagos" },
                { id: "all", label: "Todos" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStatusFilterChange(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                  statusFilter === s.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Client, Sort, and View Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Client selector */}
            <select
              value={clientFilter}
              onChange={(e) => handleClientFilterChange(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer flex-1 sm:flex-none"
            >
              <option value="all">Todos os clientes</option>
              {clients.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            {/* Sort order toggle (Date desc / asc) */}
            <button
              type="button"
              onClick={handleSortChange}
              title={sortOrder === "desc" ? "Mais recentes primeiro" : "Mais antigos primeiro"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">
                {sortOrder === "desc" ? "Data: Mais recentes" : "Data: Mais antigos"}
              </span>
              <span className="sm:hidden">{sortOrder === "desc" ? "Decresc." : "Cresc."}</span>
            </button>

            {/* View Mode toggle (Grouped vs Flat) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setViewMode("grouped");
                  setCurrentPage(1);
                }}
                title="Agrupar por cliente"
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === "grouped"
                    ? "bg-white text-indigo-600 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("flat");
                  setCurrentPage(1);
                }}
                title="Lista contínua por data"
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === "flat"
                    ? "bg-white text-indigo-600 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Floating / Sticky Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-indigo-900 text-white shadow-xl border border-indigo-700/60 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold bg-indigo-700 px-2 py-0.5 rounded-full">
                {selectedIds.length}
              </span>
              <span>selecionado(s)</span>
              <span className="text-indigo-200 font-mono font-bold">
                (${selectedTotal.toFixed(2)})
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Marcar como Pago em Lote */}
              <button
                type="button"
                onClick={() => executeBulkAction("PAID")}
                disabled={processing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marcar Pago {selectedUnpaidCount > 0 ? `(${selectedUnpaidCount})` : ""}
              </button>

              {/* Marcar como Pendente em Lote (Reverter) */}
              <button
                type="button"
                onClick={() => executeBulkAction("UNPAID")}
                disabled={processing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Marcar Pendente {selectedPaidCount > 0 ? `(${selectedPaidCount})` : ""}
              </button>

              {/* Limpar seleção */}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-800/80 hover:bg-indigo-800 text-indigo-200 text-xs font-medium cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            </div>
          </div>
        )}

        {/* Content View */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Carregando pagamentos...
          </div>
        ) : sortedPayments.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Nenhum atendimento encontrado com os filtros selecionados.
          </div>
        ) : viewMode === "grouped" ? (
          /* ================= GROUPED BY CLIENT VIEW ================= */
          <div className="space-y-4">
            {paginatedGroups.map(({ client, items }) => {
              const groupIds = items.map((i) => i.id);
              const allSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.includes(id));
              const groupTotal = items.reduce((acc, i) => acc + Number(i.price), 0);
              const groupUnpaid = items
                .filter((i) => !i.paid)
                .reduce((acc, i) => acc + Number(i.price), 0);

              return (
                <div
                  key={client?.id || "sem-cliente"}
                  className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden"
                >
                  <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleSelectGroup(items)}
                        title="Selecionar todos deste cliente"
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {client?.name || "Sem cliente"}
                        </h3>
                        <span className="text-[10px] text-slate-500 font-medium block sm:inline">
                          {client?.billingType === "CONSOLIDATED_MONTHLY"
                            ? "Acerto mensal"
                            : "Paga por atendimento"}{" "}
                          • {items.length} atendimento(s)
                        </span>
                      </div>
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
                        className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(appt.id)}
                            onChange={() => toggleSelect(appt.id)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{appt.title}</p>
                            <p className="text-slate-500 font-mono text-[11px] flex items-center gap-1.5 flex-wrap">
                              <span>{new Date(appt.date).toLocaleDateString("pt-BR")}</span>
                              {appt.startTime && (
                                <span className="text-slate-400">• {appt.startTime}</span>
                              )}
                              {isOverdue(appt) && (
                                <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold uppercase">
                                  Atrasado
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`font-mono font-bold ${paymentTextColor(appt)}`}>
                            ${Number(appt.price).toFixed(2)}
                          </span>

                          {appt.paid ? (
                            <button
                              type="button"
                              onClick={() => markUnpaid(appt.id)}
                              disabled={processing}
                              title="Clique para reverter para pendente"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] hover:bg-emerald-100 disabled:opacity-50 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Pago</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => markPaid(appt.id)}
                              disabled={processing}
                              title="Clique para marcar como pago"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-slate-600 border border-slate-200 font-bold text-[11px] hover:bg-slate-100 disabled:opacity-50 cursor-pointer transition-colors"
                            >
                              <Circle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Marcar Pago</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ================= FLAT LIST VIEW BY DATE ================= */
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={
                    paginatedFlat.length > 0 &&
                    paginatedFlat.every((item) => selectedIds.includes(item.id))
                  }
                  onChange={selectAllVisible}
                  title="Selecionar todos nesta página"
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Atendimento / Cliente</span>
              </div>
              <div className="flex items-center gap-6">
                <span>Data</span>
                <span>Valor / Status</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {paginatedFlat.map((appt) => (
                <div
                  key={appt.id}
                  className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(appt.id)}
                      onChange={() => toggleSelect(appt.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{appt.title}</p>
                      <p className="text-slate-500 text-[11px] truncate">
                        {appt.client?.name || "Sem cliente"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <div className="text-right">
                      <p className="font-mono text-slate-800 text-[11px]">
                        {new Date(appt.date).toLocaleDateString("pt-BR")}
                      </p>
                      {isOverdue(appt) && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold uppercase inline-block">
                          Atrasado
                        </span>
                      )}
                    </div>

                    <span className={`font-mono font-bold text-sm ${paymentTextColor(appt)}`}>
                      ${Number(appt.price).toFixed(2)}
                    </span>

                    {appt.paid ? (
                      <button
                        type="button"
                        onClick={() => markUnpaid(appt.id)}
                        disabled={processing}
                        title="Clique para reverter para pendente"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] hover:bg-emerald-100 disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Pago</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markPaid(appt.id)}
                        disabled={processing}
                        title="Clique para marcar como pago"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-slate-600 border border-slate-200 font-bold text-[11px] hover:bg-slate-100 disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        <Circle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Pendente</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reusable Pagination Component */}
        {totalPaginationCount > 0 && (
          <Pagination
            totalItems={totalPaginationCount}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[5, 10, 20, 50]}
          />
        )}
      </div>
    </div>
  );
}
