"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  Sun,
  Clock,
  MapPin,
  Navigation,
  CheckCircle2,
  Plus,
  RefreshCw,
  Smartphone,
  Search,
  DollarSign,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Ban,
} from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { AppointmentModal } from "@/components/ui/appointment-modal";
import { motion } from "framer-motion";

type ViewMode = "month" | "week" | "today";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [originFilter, setOriginFilter] = useState("ALL");

  // Navigation offsets — independentes por view, para preservar posição ao trocar de aba
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

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
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null);

  const openEditModal = (appt: any) => {
    setEditingAppointment(appt);
    setIsAppointmentModalOpen(true);
  };

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
    return appointments.filter((appt) => {
      const q = search.toLowerCase();
      const matchSearch =
        appt.title?.toLowerCase().includes(q) ||
        appt.client?.name?.toLowerCase().includes(q) ||
        appt.location?.toLowerCase().includes(q);

      const matchStatus = statusFilter === "ALL" || appt.status === statusFilter;

      const matchOrigin =
        originFilter === "ALL" ||
        (originFilter === "ICLOUD" && (appt.origin === "ICLOUD_SYNC" || appt.externalEventId)) ||
        (originFilter === "INTERNAL" && appt.origin !== "ICLOUD_SYNC" && !appt.externalEventId);

      return matchSearch && matchStatus && matchOrigin;
    });
  }, [appointments, search, statusFilter, originFilter]);

  // Agendamentos filtrados, agrupados por data (yyyy-mm-dd) — usado pelas 3 views
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const appt of filtered) {
      const key = new Date(appt.date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    return map;
  }, [filtered]);

  // Statistics (sobre todos os agendamentos, não só os filtrados na view atual)
  const stats = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter((a) => a.status === "COMPLETED").length;
    const scheduled = appointments.filter((a) => a.status === "SCHEDULED").length;
    const revenue = appointments.reduce(
      (acc, a) =>
        acc + (a.status === "COMPLETED" && a.billable !== false ? Number(a.price || 0) : 0),
      0
    );
    const pendingRevenue = appointments.reduce(
      (acc, a) =>
        acc + (a.status === "SCHEDULED" && a.billable !== false ? Number(a.price || 0) : 0),
      0
    );

    return { total, completed, scheduled, revenue, pendingRevenue };
  }, [appointments]);

  // --- Week view: domingo como primeiro dia da semana ---
  const weekDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Domingo
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
    sunday.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekOffset]);

  // --- Month view: grade completa domingo→sábado cobrindo o mês ---
  const monthCursor = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthDays = useMemo(() => {
    const firstOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const lastOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);

    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    const gridEnd = new Date(lastOfMonth);
    gridEnd.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));

    const days: Date[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [monthCursor]);

  const todayKey = dateKey(new Date());
  const todayAppointments = appointmentsByDate[todayKey] || [];

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const renderAppointmentCard = (appt: any) => (
    <div
      key={appt.id}
      onClick={() => openEditModal(appt)}
      className="p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-col gap-3 shadow-xs hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-xs font-bold text-indigo-600 truncate">{appt.title}</span>
            {(appt.origin === "ICLOUD_SYNC" || appt.externalEventId) && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                <Smartphone className="w-2.5 h-2.5" />
                <span>iPhone</span>
              </span>
            )}
            {appt.billable === false && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                <Ban className="w-2.5 h-2.5" />
                <span>Não Faturável</span>
              </span>
            )}
          </div>
          <h4 className="font-bold text-slate-900 text-sm truncate">{appt.client?.name}</h4>
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{formatTime(appt.startTime)}</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end shrink-0">
          <span className="text-base font-black text-emerald-600 block font-mono">
            ${Number(appt.price).toFixed(2)}
          </span>
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border mt-1 ${
              appt.status === "COMPLETED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {appt.status === "COMPLETED" ? "Concluído" : "Agendado"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        {appt.location ? (
          <div className="flex items-center gap-1.5 text-slate-600 text-xs truncate max-w-[160px]">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="truncate font-mono">{appt.location}</span>
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Agendamentos"
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
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todos os status</option>
              <option value="SCHEDULED">Agendados</option>
              <option value="COMPLETED">Concluídos</option>
            </select>

            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todas as origens</option>
              <option value="ICLOUD">📱 iPhone iCloud</option>
              <option value="INTERNAL">Internos</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle: Mês / Semana / Hoje */}
            <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <button
                onClick={() => setViewMode("month")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "month" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Mês</span>
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "week" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Semana</span>
              </button>
              <button
                onClick={() => setViewMode("today")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "today" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Hoje</span>
              </button>
            </div>

            {/* Novo Agendamento Button */}
            <button
              onClick={() => {
                setEditingAppointment(null);
                setIsAppointmentModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </button>
          </div>
        </div>

        {/* Content Views */}
        {viewMode === "month" && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 capitalize">
                {monthCursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMonthOffset((p) => p - 1)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMonthOffset(0)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  onClick={() => setMonthOffset((p) => p + 1)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="text-center text-[10px] font-bold uppercase text-slate-400 pb-1">
                  {label}
                </div>
              ))}

              {monthDays.map((day) => {
                const key = dateKey(day);
                const dayAppts = appointmentsByDate[key] || [];
                const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                const isToday = key === todayKey;

                return (
                  <div
                    key={key}
                    className={`min-h-[92px] rounded-xl p-1.5 border flex flex-col gap-1 ${
                      isToday
                        ? "bg-indigo-50/60 border-indigo-200 ring-1 ring-indigo-500/20"
                        : isCurrentMonth
                        ? "bg-white border-slate-200/70"
                        : "bg-slate-50/50 border-slate-100"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-bold ${
                        isToday ? "text-indigo-600" : isCurrentMonth ? "text-slate-700" : "text-slate-300"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayAppts.slice(0, 3).map((appt) => (
                        <div
                          key={appt.id}
                          onClick={() => openEditModal(appt)}
                          title={`${formatTime(appt.startTime)} • ${appt.client?.name} • ${appt.title}`}
                          className={`text-[9px] px-1 py-0.5 rounded truncate font-medium cursor-pointer hover:ring-1 hover:ring-indigo-400 ${
                            appt.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-indigo-50 text-indigo-700"
                          }`}
                        >
                          {formatTime(appt.startTime)} {appt.client?.name}
                        </div>
                      ))}
                      {dayAppts.length > 3 && (
                        <div className="text-[9px] text-slate-400 font-semibold px-1">
                          +{dayAppts.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                {weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} —{" "}
                {weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeekOffset((p) => p - 1)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setWeekOffset(0)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  onClick={() => setWeekOffset((p) => p + 1)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map((day) => {
                const key = dateKey(day);
                const dayAppts = appointmentsByDate[key] || [];
                const isToday = key === todayKey;

                return (
                  <div
                    key={key}
                    className={`rounded-2xl p-3 border min-h-[180px] ${
                      isToday
                        ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-500/20"
                        : "bg-white border-slate-200/80"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          {WEEKDAY_LABELS[day.getDay()]}
                        </span>
                        <span className={`text-sm font-black ${isToday ? "text-indigo-600" : "text-slate-900"}`}>
                          {day.getDate()}
                        </span>
                      </div>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-bold">
                          Hoje
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {dayAppts.length === 0 ? (
                        <div className="text-[10px] text-slate-400 italic text-center py-4">Sem atendimentos</div>
                      ) : (
                        dayAppts.map((appt) => (
                          <div
                            key={appt.id}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                            onClick={() => openEditModal(appt)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[11px] text-slate-900 truncate max-w-[90px]">
                                {appt.client?.name}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-emerald-600">
                                ${Number(appt.price).toFixed(0)}
                              </span>
                            </div>
                            <div className="text-[10px] text-indigo-600 font-medium truncate mt-0.5">
                              {appt.title}
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                              {formatTime(appt.startTime)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "today" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <h3 className="font-bold text-base text-slate-900">
              Hoje •{" "}
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </h3>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                Carregando atendimentos...
              </div>
            ) : todayAppointments.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                Nenhum atendimento para hoje com os filtros selecionados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todayAppointments.map(renderAppointmentCard)}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        appointment={editingAppointment}
        onClose={() => {
          setIsAppointmentModalOpen(false);
          setEditingAppointment(null);
        }}
        onSuccess={() => {
          fetchAppointments();
        }}
      />
    </div>
  );
}
