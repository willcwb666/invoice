"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/dashboard/header";
import { Pagination } from "@/components/ui/pagination";
import { ActionButton } from "@/components/ui/action-button";
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
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";

function formatApptDateTime(dateVal: string | Date, startTimeVal?: string | Date): string {
  const d = new Date(startTimeVal || dateVal);
  if (isNaN(d.getTime())) return "-";
  const dateStr = d.toLocaleDateString("pt-BR", { timeZone: "America/Denver" });
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Denver",
  });
  return `${dateStr} - ${timeStr}`;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ totalPaid: number; totalUnpaid: number; count: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("flat");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      const timeA = new Date(a.startTime || a.date).getTime();
      const timeB = new Date(b.startTime || b.date).getTime();
      if (timeA !== timeB) {
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      }
      return sortOrder === "desc"
        ? String(b.startTime || "").localeCompare(String(a.startTime || ""))
        : String(a.startTime || "").localeCompare(String(b.startTime || ""));
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

  const paymentTextColor = (appt: any) => {
    if (appt.paid) return "text-emerald-600";
    if (isOverdue(appt)) return "text-rose-600";
    return "text-amber-600";
  };

  const statusDotColor = (appt: any) => {
    if (appt.paid) return "bg-emerald-500 shadow-xs shadow-emerald-500/50";
    if (isOverdue(appt)) return "bg-rose-500 shadow-xs shadow-rose-500/50";
    return "bg-amber-500 shadow-xs shadow-amber-500/50";
  };

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

  const toggleCompleted = async (id: string) => {
    setProcessingId(id);
    try {
      await fetch(`/api/v1/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_completed" }),
      });
      await fetchPayments();
    } finally {
      setProcessingId(null);
    }
  };

  const togglePaid = async (id: string, currentPaid: boolean) => {
    setProcessingId(id);
    try {
      await fetch(`/api/v1/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: currentPaid ? "mark_unpaid" : "mark_paid" }),
      });
      await fetchPayments();
    } finally {
      setProcessingId(null);
    }
  };

  const executeBulkAction = async (action: "PAID" | "UNPAID" | "COMPLETE" | "UNCOMPLETE") => {
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

  const selectedIncompleteCount = useMemo(
    () => selectedAppointments.filter((p) => p.status !== "COMPLETED").length,
    [selectedAppointments]
  );

  const selectedCompleteCount = useMemo(
    () => selectedAppointments.filter((p) => p.status === "COMPLETED").length,
    [selectedAppointments]
  );

  const totalPaginationCount = viewMode === "grouped" ? grouped.length : sortedPayments.length;

  const renderSingleLineRow = (appt: any) => {
    const isBusy = processingId === appt.id;
    const isCompleted = appt.status === "COMPLETED";
    const serviceName = appt.services?.[0]?.service?.name || appt.title || "Standard cleaning";

    return (
      <div
        key={appt.id}
        className="flex items-center gap-4 px-4 sm:px-5 py-3 hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-b-0 min-w-[780px] text-xs font-normal"
      >
        {/* Selection Checkbox */}
        <div className="w-5 shrink-0 flex items-center justify-center">
          <input
            type="checkbox"
            checked={selectedIds.includes(appt.id)}
            onChange={() => toggleSelect(appt.id)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {/* 1. Data - Hora Início */}
        <div className="w-44 shrink-0 font-mono text-slate-700 font-semibold text-[11px] truncate">
          {formatApptDateTime(appt.date, appt.startTime)}
        </div>

        {/* 2. Nome Cliente */}
        <div className="w-40 shrink-0 font-bold text-slate-900 truncate" title={appt.client?.name}>
          {appt.client?.name || "Sem cliente"}
        </div>

        {/* 3. Serviço */}
        <div className="flex-1 min-w-[170px] text-slate-600 font-medium truncate" title={serviceName}>
          {serviceName}
        </div>

        {/* 4. Bolinha Status + Total */}
        <div className="w-36 shrink-0 flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotColor(appt)}`}
            title={
              appt.paid ? "Status: Pago" : isOverdue(appt) ? "Status: Atrasado" : "Status: Pendente"
            }
          />
          <span className={`font-mono font-bold text-xs ${paymentTextColor(appt)}`}>
            Total: ${Number(appt.price).toFixed(2)}
          </span>
        </div>

        {/* 5. Ações (Concluído & Pago) */}
        <div className="w-24 shrink-0 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Ação Concluído */}
          <ActionButton
            icon={
              isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : isCompleted ? (
                <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )
            }
            tooltip={isCompleted ? "Concluído (clique para desmarcar)" : "Marcar como Concluído"}
            hoverColor="purple"
            activeColor="none"
            className={isCompleted ? "!bg-indigo-50/80 !border-indigo-200" : ""}
            disabled={isBusy}
            onClick={() => toggleCompleted(appt.id)}
          />

          {/* Ação Pago */}
          <ActionButton
            icon={
              isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : appt.paid ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-400" />
              )
            }
            tooltip={appt.paid ? "Pago (clique para reverter para pendente)" : "Marcar como Pago"}
            hoverColor="green"
            activeColor={appt.paid ? "green" : "none"}
            disabled={isBusy}
            onClick={() => togglePaid(appt.id, appt.paid)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Pagamentos"
        subtitle="Controle de quais limpezas já foram pagas pelo cliente, fora do fluxo de faturas"
        onRefresh={fetchPayments}
        loading={loading}
      />

      <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
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
              {/* Marcar Concluído em Lote */}
              <button
                type="button"
                onClick={() => executeBulkAction("COMPLETE")}
                disabled={processing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer transition-colors"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Marcar Concluído {selectedIncompleteCount > 0 ? `(${selectedIncompleteCount})` : ""}
              </button>

              {/* Marcar como Pago em Lote */}
              <button
                type="button"
                onClick={() => executeBulkAction("PAID")}
                disabled={processing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marcar Pago {selectedUnpaidCount > 0 ? `(${selectedUnpaidCount})` : ""}
              </button>

              {/* Marcar como Pendente em Lote (Reverter Pagamento) */}
              <button
                type="button"
                onClick={() => executeBulkAction("UNPAID")}
                disabled={processing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Marcar Pendente {selectedPaidCount > 0 ? `(${selectedPaidCount})` : ""}
              </button>

              {/* Desmarcar Conclusão em Lote */}
              <button
                type="button"
                onClick={() => executeBulkAction("UNCOMPLETE")}
                disabled={processing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-800/80 hover:bg-indigo-800 text-indigo-200 text-xs font-medium cursor-pointer transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Desmarcar Concluído {selectedCompleteCount > 0 ? `(${selectedCompleteCount})` : ""}</span>
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

                  {/* Single Line Header & Items */}
                  <div className="overflow-x-auto">
                    <div className="flex items-center gap-4 px-4 sm:px-5 py-2.5 bg-slate-50/40 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[780px]">
                      <div className="w-5 shrink-0" />
                      <div className="w-44 shrink-0">Data - Hora Início</div>
                      <div className="w-40 shrink-0">Cliente</div>
                      <div className="flex-1 min-w-[170px]">Serviço</div>
                      <div className="w-36 shrink-0">Status & Total</div>
                      <div className="w-24 shrink-0 text-right pr-1">Ações</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {items.map((appt) => renderSingleLineRow(appt))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ================= FLAT LIST VIEW BY DATE ================= */
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Header */}
            <div className="overflow-x-auto">
              <div className="flex items-center gap-4 px-4 sm:px-5 py-3 bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[780px]">
                <div className="w-5 shrink-0 flex items-center justify-center">
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
                </div>
                <div className="w-44 shrink-0">Data - Hora Início</div>
                <div className="w-40 shrink-0">Cliente</div>
                <div className="flex-1 min-w-[170px]">Serviço</div>
                <div className="w-36 shrink-0">Status & Total</div>
                <div className="w-24 shrink-0 text-right pr-1">Ações</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {paginatedFlat.map((appt) => renderSingleLineRow(appt))}
              </div>
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
