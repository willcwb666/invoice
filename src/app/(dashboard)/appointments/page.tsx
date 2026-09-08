"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Smartphone,
  LayoutGrid,
  Table as TableIcon,
  Search,
  DollarSign,
  CalendarCheck,
  Check,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ActionButton } from "@/components/ui/action-button";
import { AppointmentModal } from "@/components/ui/appointment-modal";
import { motion } from "framer-motion";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [originFilter, setOriginFilter] = useState("ALL");

  // Sync state
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [calendarSyncInfo, setCalendarSyncInfo] = useState<{
    configured: boolean;
    icloudCalendarUrl: string;
    syncedCount: number;
    lastSyncedAt: string | null;
  }>({
    configured: true,
    icloudCalendarUrl: "",
    syncedCount: 0,
    lastSyncedAt: null,
  });

  // Modal
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchSyncInfo = async () => {
    try {
      const res = await fetch("/api/v1/agenda/sync");
      if (res.ok) {
        const json = await res.json();
        setCalendarSyncInfo({
          configured: Boolean(json.configured),
          icloudCalendarUrl: json.icloudCalendarUrl || "",
          syncedCount: json.syncedCount || 0,
          lastSyncedAt: json.lastSyncedAt || null,
        });
      }
    } catch (e) {
      console.error("Erro ao consultar status da sincronização:", e);
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/appointments");
      if (res.ok) {
        const json = await res.json();
        setAppointments(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchSyncInfo();
  }, []);

  const handleSyncCalendarNow = async () => {
    setSyncingCalendar(true);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/v1/agenda/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icloudUrl: calendarSyncInfo.icloudCalendarUrl }),
      });
      const json = await res.json();
      if (res.ok) {
        setSyncFeedback(`✓ ${json.message || "Sincronização concluída com sucesso!"}`);
        await Promise.all([fetchAppointments(), fetchSyncInfo()]);
      } else {
        setSyncFeedback(`Aviso: ${json.error || "Não foi possível sincronizar no momento."}`);
      }
    } catch (e) {
      setSyncFeedback("Aviso: Falha ao conectar ao servidor do iCloud.");
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleCompleteAppointment = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok) {
        fetchAppointments();
      }
    } catch (e) {
      console.error("Erro ao concluir agendamento:", e);
    }
  };

  const filtered = useMemo(() => {
    return appointments
      .filter((appt) => {
        const q = search.toLowerCase();
        const matchSearch =
          appt.title?.toLowerCase().includes(q) ||
          appt.client?.name?.toLowerCase().includes(q) ||
          appt.location?.toLowerCase().includes(q);

        const matchStatus =
          statusFilter === "ALL" || appt.status === statusFilter;

        const matchOrigin =
          originFilter === "ALL" ||
          (originFilter === "ICLOUD" && (appt.origin === "ICLOUD_SYNC" || appt.externalEventId)) ||
          (originFilter === "INTERNAL" && appt.origin !== "ICLOUD_SYNC" && !appt.externalEventId);

        return matchSearch && matchStatus && matchOrigin;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, search, statusFilter, originFilter]);

  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Statistics
  const stats = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter((a) => a.status === "COMPLETED").length;
    const scheduled = appointments.filter((a) => a.status === "SCHEDULED").length;
    const revenue = appointments.reduce(
      (acc, a) => acc + (a.status === "COMPLETED" ? Number(a.price || 0) : 0),
      0
    );
    const pendingRevenue = appointments.reduce(
      (acc, a) => acc + (a.status === "SCHEDULED" ? Number(a.price || 0) : 0),
      0
    );

    return { total, completed, scheduled, revenue, pendingRevenue };
  }, [appointments]);

  const columns: ColumnDef<any>[] = [
    {
      key: "date",
      header: "Data & Horário",
      sortable: true,
      className: "w-44",
      render: (appt) => (
        <div className="space-y-0.5">
          <span className="font-bold text-slate-900 text-xs block">
            {new Date(appt.date).toLocaleDateString("pt-BR")}
          </span>
          <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            {new Date(appt.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      ),
      sortValue: (appt) => new Date(appt.date),
    },
    {
      key: "client",
      header: "Cliente & Serviço",
      sortable: true,
      render: (appt) => (
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-900 text-xs">{appt.client?.name}</span>
            {(appt.origin === "ICLOUD_SYNC" || appt.externalEventId) && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Smartphone className="w-2.5 h-2.5" />
                <span>iPhone</span>
              </span>
            )}
          </div>
          <span className="text-indigo-600 text-[11px] font-medium block truncate max-w-[220px]">
            {appt.title}
          </span>
        </div>
      ),
      sortValue: (appt) => appt.client?.name || "",
    },
    {
      key: "location",
      header: "Localização (GPS)",
      sortable: true,
      render: (appt) =>
        appt.location ? (
          <div className="flex items-center gap-1 text-slate-700 font-mono text-[11px] max-w-[200px] truncate">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="truncate">{appt.location}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-[11px]">-</span>
        ),
      sortValue: (appt) => appt.location || "",
    },
    {
      key: "price",
      header: "Valor ($)",
      sortable: true,
      className: "text-right",
      render: (appt) => (
        <span className="font-mono font-bold text-emerald-600 text-xs block text-right">
          ${Number(appt.price).toFixed(2)}
        </span>
      ),
      sortValue: (appt) => Number(appt.price),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (appt) => {
        const isDone = appt.status === "COMPLETED";
        return (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              isDone
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
            <span>{isDone ? "Concluído" : "Agendado"}</span>
          </span>
        );
      },
      sortValue: (appt) => appt.status,
    },
    {
      key: "actions",
      header: "Rotas & Ação",
      sortable: false,
      className: "w-40 text-right",
      render: (appt) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {appt.location && (
            <ActionButton
              icon={<Navigation className="w-3.5 h-3.5" />}
              tooltip="Navegar no Apple Maps"
              hoverColor="blue"
              href={`https://maps.apple.com/?daddr=${encodeURIComponent(appt.location)}`}
            />
          )}

          {appt.location && (
            <ActionButton
              icon={<Navigation className="w-3.5 h-3.5 text-emerald-600" />}
              tooltip="Navegar no Google Maps"
              hoverColor="green"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(appt.location)}`}
            />
          )}

          {appt.status !== "COMPLETED" && (
            <ActionButton
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              tooltip="Marcar como Concluído"
              hoverColor="green"
              onClick={() => handleCompleteAppointment(appt.id)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Agendamentos & Atendimentos"
        subtitle="Atendimentos operacionais sincronizados com o iPhone e rotas GPS"
        onRefresh={fetchAppointments}
        loading={loading}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Sincronização iPhone Banner */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Sincronização Ativa com o iPhone da Renata
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sincronizado
                </span>
                {calendarSyncInfo.syncedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                    {calendarSyncInfo.syncedCount} eventos do iCloud
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Qualquer limpeza marcada no Calendário do iPhone da esposa é importada automaticamente com rota GPS e cliente.
              </p>
              {calendarSyncInfo.icloudCalendarUrl && (
                <div className="text-[11px] font-mono text-slate-400 truncate max-w-xl">
                  {calendarSyncInfo.icloudCalendarUrl}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={handleSyncCalendarNow}
              disabled={syncingCalendar}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingCalendar ? "animate-spin" : ""}`} />
              <span>{syncingCalendar ? "Sincronizando..." : "Sincronizar iPhone Agora"}</span>
            </button>

            <Link
              href="/settings"
              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 font-semibold text-slate-700 hover:text-indigo-700 text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              <span>Configurações</span>
            </Link>
          </div>
        </div>

        {syncFeedback && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <span>{syncFeedback}</span>
            <button
              onClick={() => setSyncFeedback(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Atendimentos</span>
              <CalendarCheck className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
            <p className="text-[11px] text-slate-400 mt-1">Registrados na base</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold">
              <span>Agendados</span>
              <Clock className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-600 mt-2">{stats.scheduled}</p>
            <p className="text-[11px] text-slate-500 mt-1">${stats.pendingRevenue.toFixed(2)} previstos</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
              <span>Concluídos</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-2">{stats.completed}</p>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">Prontos para faturar</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
              <span>Faturamento Realizado</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-2 font-mono">
              ${stats.revenue.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">De atendimentos concluídos</p>
          </div>
        </div>

        {/* Filters & View Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, serviço ou local..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todos os status</option>
              <option value="SCHEDULED">Agendados</option>
              <option value="COMPLETED">Concluídos</option>
            </select>

            <select
              value={originFilter}
              onChange={(e) => {
                setOriginFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todas as origens</option>
              <option value="ICLOUD">📱 iPhone iCloud</option>
              <option value="INTERNAL">Internos</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <button
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabela</span>
              </button>
            </div>

            {/* Novo Agendamento Button */}
            <button
              onClick={() => setIsAppointmentModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </button>
          </div>
        </div>

        {/* Content Views */}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedAppointments.length === 0 ? (
              <div className="col-span-2 p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                {loading
                  ? "Carregando atendimentos..."
                  : "Nenhum atendimento encontrado com os filtros selecionados."}
              </div>
            ) : (
              paginatedAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200/80 flex flex-col justify-between gap-4 shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-xs font-bold text-indigo-600 block">{appt.title}</span>
                        {(appt.origin === "ICLOUD_SYNC" || appt.externalEventId) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Smartphone className="w-2.5 h-2.5" />
                            <span>iPhone</span>
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 text-base">{appt.client?.name}</h4>
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(appt.date).toLocaleDateString("pt-BR")} •{" "}
                          {new Date(appt.startTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-lg font-black text-emerald-600 block font-mono">
                        ${Number(appt.price).toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                          appt.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {appt.status === "COMPLETED" ? "Concluído" : "Agendado"}
                      </span>
                      {appt.status !== "COMPLETED" && (
                        <button
                          onClick={() => handleCompleteAppointment(appt.id)}
                          className="mt-2 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold inline-flex items-center gap-1 transition-colors border border-emerald-200 cursor-pointer"
                          title="Marcar como concluído"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Concluir</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* GPS Buttons */}
                  {appt.location && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-600 text-xs truncate max-w-[200px]">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate font-mono">{appt.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://maps.apple.com/?daddr=${encodeURIComponent(appt.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs inline-flex items-center gap-1.5 border border-indigo-200 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Apple Maps</span>
                        </a>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                            appt.location
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 border border-slate-200 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Google Maps</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
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
                  ? "Carregando atendimentos..."
                  : "Nenhum atendimento encontrado com os filtros selecionados."
              }
            />
          </motion.div>
        )}

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

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        onSuccess={() => {
          fetchAppointments();
        }}
      />
    </div>
  );
}
