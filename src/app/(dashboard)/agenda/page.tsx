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
  ChevronLeft,
  ChevronRight,
  Ban,
  Sliders,
  Check,
  Save,
  Sparkles,
  FileText,
  Users,
  WifiOff,
  CloudUpload,
  Repeat,
} from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { AppointmentModal } from "@/components/ui/appointment-modal";
import { AgendaInvoiceModal } from "@/components/ui/agenda-invoice-modal";
import {
  saveCachedAppointments,
  getCachedAppointments,
} from "@/lib/offline/offline-agenda";
import { useOfflineStatus } from "@/lib/offline/use-offline-status";
import { useToast } from "@/components/ui/toast";
import { motion, AnimatePresence } from "framer-motion";

type ViewMode = "month" | "week" | "today";
type ActiveTab = "calendar" | "operating_hours";

interface DaySchedule {
  dayId: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  dayName: string;
  isOpen: boolean;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  breakStart: string;
  breakEnd: string;
  preferredCity: string;
}

const DEFAULT_SCHEDULE: DaySchedule[] = [
  {
    dayId: 1,
    dayName: "Segunda-feira",
    isOpen: true,
    startTime: "08:00",
    endTime: "17:00",
    maxCapacity: 3,
    breakStart: "12:00",
    breakEnd: "13:00",
    preferredCity: "Greeley",
  },
  {
    dayId: 2,
    dayName: "Terça-feira",
    isOpen: true,
    startTime: "08:00",
    endTime: "17:00",
    maxCapacity: 3,
    breakStart: "12:00",
    breakEnd: "13:00",
    preferredCity: "Evans",
  },
  {
    dayId: 3,
    dayName: "Quarta-feira",
    isOpen: true,
    startTime: "08:00",
    endTime: "17:00",
    maxCapacity: 3,
    breakStart: "12:00",
    breakEnd: "13:00",
    preferredCity: "Greeley",
  },
  {
    dayId: 4,
    dayName: "Quinta-feira",
    isOpen: true,
    startTime: "08:00",
    endTime: "17:00",
    maxCapacity: 3,
    breakStart: "12:00",
    breakEnd: "13:00",
    preferredCity: "Evans",
  },
  {
    dayId: 5,
    dayName: "Sexta-feira",
    isOpen: true,
    startTime: "08:00",
    endTime: "16:00",
    maxCapacity: 2,
    breakStart: "12:00",
    breakEnd: "13:00",
    preferredCity: "Greeley & Evans",
  },
  {
    dayId: 6,
    dayName: "Sábado",
    isOpen: false,
    startTime: "09:00",
    endTime: "14:00",
    maxCapacity: 1,
    breakStart: "12:00",
    breakEnd: "12:30",
    preferredCity: "Sob Consulta",
  },
  {
    dayId: 0,
    dayName: "Domingo",
    isOpen: false,
    startTime: "08:00",
    endTime: "12:00",
    maxCapacity: 0,
    breakStart: "12:00",
    breakEnd: "12:00",
    preferredCity: "Fechado (Descanso)",
  },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Não sincronizado";
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  if (isNaN(diffMs) || diffMs < 0) return "Sincronizado agora mesmo";
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Sincronizado agora mesmo";
  if (diffMin < 60) return `Sincronizado há ${diffMin} ${diffMin === 1 ? "minuto" : "minutos"}`;
  if (diffHours < 24) return `Sincronizado há ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  if (diffDays === 1) return "Sincronizado ontem";
  return `Sincronizado há ${diffDays} dias`;
}

export default function AgendaPage() {
  const { isOffline, pendingSyncCount, isSyncing, triggerSync } = useOfflineStatus();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [originFilter, setOriginFilter] = useState("ALL");

  // Navigation offsets
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  // Month view expanded days
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleExpandDay = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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

  // Capacity / Operating Hours & Route Parameters State
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [routeParams, setRouteParams] = useState<{
    travelBufferMinutes: number;
    standardMin: string;
    standardMax: string;
    deepMin: string;
    deepMax: string;
  }>({
    travelBufferMinutes: 10,
    standardMin: "1h45",
    standardMax: "2h30",
    deepMin: "4h00",
    deepMax: "6h00",
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modal
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null);
  const [newAppointmentDate, setNewAppointmentDate] = useState<string | null>(null);
  const [isAgendaInvoiceModalOpen, setIsAgendaInvoiceModalOpen] = useState(false);

  // Re-render relative timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Load schedule & route parameters from localStorage + company profile
  useEffect(() => {
    try {
      const saved = localStorage.getItem("invoice_weekly_schedule");
      if (saved) setSchedule(JSON.parse(saved));
      const savedRouteParams = localStorage.getItem("invoice_agenda_route_params");
      if (savedRouteParams) {
        setRouteParams((prev) => ({ ...prev, ...JSON.parse(savedRouteParams) }));
      }
    } catch {}

    fetch("/api/v1/company", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data && Number.isFinite(Number(json.data.travelBufferMinutes))) {
          setRouteParams((prev) => ({
            ...prev,
            travelBufferMinutes: Number(json.data.travelBufferMinutes),
          }));
        }
      })
      .catch(() => {});
  }, []);

  const fetchAppointments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/v1/appointments?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setAppointments(list);
        const cachedOk = saveCachedAppointments(list);
        if (!cachedOk) {
          showToast(
            "Não foi possível salvar os agendamentos para uso offline neste aparelho (pouco espaço de armazenamento). O modo offline pode ficar com dados desatualizados.",
            "warning",
            8000
          );
        }
      } else {
        const cached = getCachedAppointments();
        if (cached.length > 0) setAppointments(cached);
      }
    } catch (e) {
      console.warn("Sem conexão com o servidor. Carregando dados da memória local...", e);
      const cached = getCachedAppointments();
      if (cached.length > 0) setAppointments(cached);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchSyncInfo = async (checkAutoSync = true) => {
    try {
      const res = await fetch(`/api/v1/agenda/sync?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const json = await res.json();
        const info = {
          configured: Boolean(json.configured),
          icloudCalendarUrl: json.icloudCalendarUrl || "",
          syncedCount: json.syncedCount || 0,
          lastSyncedAt: json.lastSyncedAt || null,
        };
        setCalendarSyncInfo(info);

        // Auto-sync sob demanda em background se o último foi há mais de 30 min
        if (checkAutoSync && info.configured && info.icloudCalendarUrl) {
          const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
          const isStale = !info.lastSyncedAt || new Date(info.lastSyncedAt).getTime() < thirtyMinutesAgo;
          if (isStale) {
            handleSyncCalendarNow(false, info.icloudCalendarUrl);
          }
        }
      }
    } catch (e) {
      console.error("Erro ao consultar status da sincronização:", e);
    }
  };

  useEffect(() => {
    fetchAppointments(true).finally(() => {
      fetchSyncInfo(true);
    });
  }, []);

  const handleSyncCalendarNow = async (manual = true, urlOverride?: string) => {
    setSyncingCalendar(true);
    if (manual) setSyncFeedback(null);
    try {
      const res = await fetch("/api/v1/agenda/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icloudUrl: urlOverride || calendarSyncInfo.icloudCalendarUrl }),
      });
      const json = await res.json();
      if (res.ok) {
        const updatedTime = json.data?.lastSyncedAt || new Date().toISOString();
        setCalendarSyncInfo((prev) => ({
          ...prev,
          syncedCount: json.data?.totalFound ?? prev.syncedCount,
          lastSyncedAt: updatedTime,
        }));
        if (manual) {
          setSyncFeedback(`✓ ${json.message || "Sincronização com o iPhone concluída com sucesso!"}`);
        }
        await fetchAppointments(false);
      } else if (manual) {
        setSyncFeedback(`Aviso: ${json.error || "Não foi possível sincronizar no momento."}`);
      }
    } catch {
      if (manual) {
        setSyncFeedback("Aviso: Falha ao conectar ao servidor do iCloud.");
      }
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      localStorage.setItem("invoice_weekly_schedule", JSON.stringify(schedule));
      localStorage.setItem("invoice_agenda_route_params", JSON.stringify(routeParams));

      // Sync with backend company profile so route calculation uses the exact hours and travel buffer
      const openDays = schedule.filter((d) => d.isOpen);
      const earliestStart =
        openDays.length > 0
          ? openDays.map((d) => d.startTime).sort()[0]
          : "08:00";
      const latestEnd =
        openDays.length > 0
          ? openDays.map((d) => d.endTime).sort().reverse()[0]
          : "18:00";

      await fetch("/api/v1/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travelBufferMinutes: Number(routeParams.travelBufferMinutes) || 10,
          workDayStartHour: earliestStart,
          workDayEndHour: latestEnd,
        }),
      }).catch(() => {});

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Erro ao salvar agenda semanal:", e);
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDayChange = <K extends keyof DaySchedule>(
    dayId: number,
    field: K,
    value: DaySchedule[K]
  ) => {
    setSchedule((prev) =>
      prev.map((day) => (day.dayId === dayId ? { ...day, [field]: value } : day))
    );
  };

  const handleCompleteAppointment = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok) {
        fetchAppointments(false);
      }
    } catch (e) {
      console.error("Erro ao concluir agendamento:", e);
    }
  };

  // Filtros de busca e status
  const filtered = useMemo(() => {
    return appointments.filter((appt) => {
      const q = search.toLowerCase();
      const matchSearch =
        appt.title?.toLowerCase().includes(q) ||
        appt.client?.name?.toLowerCase().includes(q) ||
        appt.location?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "ALL"
          ? appt.status !== "CANCELLED"
          : appt.status === statusFilter;

      const matchOrigin =
        originFilter === "ALL"
          ? true
          : (originFilter === "ICLOUD" && (appt.origin === "ICLOUD_SYNC" || appt.externalEventId)) ||
            (originFilter === "INTERNAL" && appt.origin !== "ICLOUD_SYNC" && !appt.externalEventId);

      return matchSearch && matchStatus && matchOrigin;
    });
  }, [appointments, search, statusFilter, originFilter]);

  // Agrupamento por data local (yyyy-mm-dd)
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const appt of filtered) {
      const key = dateKey(new Date(appt.startTime || appt.date));
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    return map;
  }, [filtered]);

  // Cálculo de estatísticas
  const stats = useMemo(() => {
    const activeAppts = appointments.filter((a) => a.status !== "CANCELLED");
    const total = activeAppts.length;
    const completed = activeAppts.filter((a) => a.status === "COMPLETED").length;
    const scheduled = activeAppts.filter((a) => a.status === "SCHEDULED").length;
    const revenue = activeAppts.reduce(
      (acc, a) =>
        acc + (a.status === "COMPLETED" && a.billable !== false ? Number(a.price || 0) : 0),
      0
    );
    const pendingRevenue = activeAppts.reduce(
      (acc, a) =>
        acc + (a.status === "SCHEDULED" && a.billable !== false ? Number(a.price || 0) : 0),
      0
    );

    return { total, completed, scheduled, revenue, pendingRevenue };
  }, [appointments]);

  // --- Visualização Semanal ---
  const weekDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
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

  // --- Visualização Mensal ---
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

  const openEditModal = (appt: any) => {
    setNewAppointmentDate(null);
    setEditingAppointment(appt);
    setIsAppointmentModalOpen(true);
  };

  const openNewAppointmentOnDate = (dateStr?: string) => {
    setEditingAppointment(null);
    setNewAppointmentDate(dateStr || null);
    setIsAppointmentModalOpen(true);
  };

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
            {(appt.seriesId || (appt.recurrenceRule && appt.recurrenceRule !== "NONE")) && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0"
                title={
                  appt.recurrenceRule === "WEEKLY"
                    ? "Contrato Recorrente Semanal"
                    : appt.recurrenceRule === "BIWEEKLY"
                    ? "Contrato Recorrente Bi-semanal (Quinzenal)"
                    : appt.recurrenceRule === "EVERY_3_WEEKS"
                    ? "Contrato Recorrente a cada 3 semanas"
                    : appt.recurrenceRule === "MONTHLY"
                    ? "Contrato Recorrente Mensal"
                    : "Série Recorrente"
                }
              >
                <Repeat className="w-2.5 h-2.5" />
                <span>
                  {appt.recurrenceRule === "WEEKLY"
                    ? "Semanal"
                    : appt.recurrenceRule === "BIWEEKLY"
                    ? "Bi-semanal"
                    : appt.recurrenceRule === "EVERY_3_WEEKS"
                    ? "3 semanas"
                    : appt.recurrenceRule === "MONTHLY"
                    ? "Mensal"
                    : "Recorrente"}
                </span>
              </span>
            )}
          </div>
          <h4 className="font-bold text-slate-900 text-sm truncate">{appt.client?.name || "Cliente"}</h4>
          <div className="flex items-center gap-2 text-slate-500 text-xs mt-1 font-medium flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formatTime(appt.startTime)}</span>
            </span>
            {Array.isArray(appt.professionals) && appt.professionals.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 border border-indigo-100 text-[10px] font-bold">
                <Users className="w-3 h-3" />
                <span>{appt.professionals.map((p: any) => p.name).join(" & ")}</span>
              </span>
            )}
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
                : appt.status === "CANCELLED"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {appt.status === "COMPLETED" ? "Concluído" : appt.status === "CANCELLED" ? "Cancelado" : "Agendado"}
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
        title="Agenda & Calendário"
        subtitle={`Sincronização em tempo real com o Calendário do iPhone (iCloud) • ${formatRelativeTime(calendarSyncInfo.lastSyncedAt)}`}
        onRefresh={() => {
          fetchAppointments(true);
          fetchSyncInfo(false);
        }}
        loading={loading}
        actionSlot={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAgendaInvoiceModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              title="Selecionar trabalhos da Agenda Mensal para gerar Invoice"
            >
              <Plus className="w-4 h-4" />
              <FileText className="w-3.5 h-3.5" />
              <span>+ Invoice</span>
            </button>

            <button
              onClick={() => openNewAppointmentOnDate()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </button>
          </div>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Banner de Modo Offline & Sincronização Local */}
        {(isOffline || pendingSyncCount > 0) && (
          <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 text-amber-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                <WifiOff className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs uppercase tracking-wider text-amber-900">
                    {isOffline ? "Modo Offline Ativo" : "Sincronização Pendente"}
                  </span>
                  {pendingSyncCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">
                      {pendingSyncCount} {pendingSyncCount === 1 ? "agendamento na fila" : "agendamentos na fila"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  {isOffline
                    ? "Sem conexão com a internet. Os agendamentos estão sendo lidos e gravados na memória local do seu aparelho. Ao reconectar, a sincronização com o sistema ocorre automaticamente."
                    : `${pendingSyncCount} agendamento(s) salvo(s) offline pronto(s) para sincronização com o banco de dados.`}
                </p>
              </div>
            </div>

            {!isOffline && pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={triggerSync}
                disabled={isSyncing}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <CloudUpload className={`w-4 h-4 ${isSyncing ? "animate-bounce" : ""}`} />
                <span>{isSyncing ? "Sincronizando..." : "Sincronizar Agora"}</span>
              </button>
            )}
          </div>
        )}

        {/* Banner de Sincronização em Tempo Real com o iPhone */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-sm">
                  Calendário do iPhone Conectado (Trabalhos)
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {formatRelativeTime(calendarSyncInfo.lastSyncedAt)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Status da Agenda:{" "}
                <span className="font-semibold text-slate-700">
                  {formatRelativeTime(calendarSyncInfo.lastSyncedAt)}
                </span>
                {calendarSyncInfo.syncedCount > 0 && (
                  <> • {calendarSyncInfo.syncedCount} atendimentos importados</>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleSyncCalendarNow(true)}
              disabled={syncingCalendar}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingCalendar ? "animate-spin text-indigo-400" : ""}`} />
              <span>{syncingCalendar ? "Sincronizando..." : "Sincronizar com iPhone Agora"}</span>
            </button>
          </div>
        </div>

        {/* Feedback da sincronização manual */}
        <AnimatePresence>
          {syncFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border shadow-2xs ${
                syncFeedback.startsWith("✓")
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              <span>{syncFeedback}</span>
              <button
                onClick={() => setSyncFeedback(null)}
                className="text-slate-400 hover:text-slate-600 font-bold ml-2 p-1 rounded-md"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Abas Principais: Calendário Interativo vs Grade de Horários */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("calendar")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "calendar"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Calendário & Eventos</span>
            </button>

            <button
              onClick={() => setActiveTab("operating_hours")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "operating_hours"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Grade de Atendimento & Capacidade</span>
            </button>
          </div>
        </div>

        {/* ABA 1: CALENDÁRIO INTERATIVO */}
        {activeTab === "calendar" && (
          <div className="space-y-6">
            {/* Quick KPI stats bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Total na Base</span>
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
                <p className="text-[11px] text-indigo-600 font-medium mt-1">
                  Atendimentos mapeados
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold">
                  <span>Atendimentos Hoje</span>
                  <Sun className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-black text-indigo-600 mt-2">{todayAppointments.length}</p>
                <p className="text-[11px] text-slate-400 mt-1">Programados para hoje</p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
                  <span>Concluídos</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-600 mt-2">{stats.completed}</p>
                <p className="text-[11px] text-emerald-700 font-medium mt-1">Prontos para cobrança</p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
                  <span>Faturamento Realizado</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                  ${stats.revenue.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">De serviços finalizados</p>
              </div>
            </div>

            {/* Toolbar: Filtros & Alternador de Visão (Mês / Semana / Hoje) */}
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
                  <option value="ALL">Ativos (Agendados & Concluídos)</option>
                  <option value="SCHEDULED">Agendados</option>
                  <option value="COMPLETED">Concluídos</option>
                  <option value="CANCELLED">Cancelados no iPhone</option>
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

              {/* View Switcher: Mês / Semana / Hoje */}
              <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <button
                  onClick={() => setViewMode("month")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === "month"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Mês</span>
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === "week"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Semana</span>
                </button>
                <button
                  onClick={() => setViewMode("today")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === "today"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Hoje</span>
                </button>
              </div>
            </div>

            {/* VISÃO 1: MÊS (GRADE MENSAL COMPLETA) */}
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
                      title="Mês anterior"
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
                      title="Próximo mês"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="text-center text-[10px] font-bold uppercase text-slate-400 pb-1"
                    >
                      {label}
                    </div>
                  ))}

                  {monthDays.map((day) => {
                    const key = dateKey(day);
                    const dayAppts = appointmentsByDate[key] || [];
                    const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                    const isToday = key === todayKey;
                    const isExpanded = expandedDays.has(key);
                    const displayedAppts = isExpanded ? dayAppts : dayAppts.slice(0, 3);

                    return (
                      <div
                        key={key}
                        onClick={() => openNewAppointmentOnDate(key)}
                        title="Clique em uma área em branco para criar um novo agendamento neste dia"
                        className={`group min-h-[110px] rounded-2xl p-2 border flex flex-col gap-1 transition-all cursor-pointer ${
                          isExpanded
                            ? "bg-white border-indigo-300 ring-2 ring-indigo-400/20 shadow-md z-10"
                            : isToday
                            ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs"
                            : isCurrentMonth
                            ? "bg-white border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/15"
                            : "bg-slate-50/40 border-slate-100 opacity-60 hover:opacity-90"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                              isToday
                                ? "bg-indigo-600 text-white"
                                : isCurrentMonth
                                ? "text-slate-800"
                                : "text-slate-400"
                            }`}
                          >
                            {day.getDate()}
                          </span>
                          <div className="flex items-center gap-1">
                            {dayAppts.length > 0 && (
                              <span className="text-[9px] font-bold text-slate-400">
                                {dayAppts.length}
                              </span>
                            )}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black">
                              +
                            </span>
                          </div>
                        </div>

                        <div className={`flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-none ${
                          isExpanded ? "max-h-[260px]" : "max-h-[120px]"
                        }`}>
                          {displayedAppts.map((appt) => (
                            <button
                              key={appt.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(appt);
                              }}
                              className={`text-left px-1.5 py-1 rounded-lg text-[10px] font-medium truncate flex items-center justify-between gap-1 border transition-colors cursor-pointer ${
                                appt.status === "COMPLETED"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                  : appt.status === "CANCELLED"
                                  ? "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 line-through opacity-75"
                                  : "bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100"
                              }`}
                            >
                              <span className="truncate flex-1 flex items-center gap-1">
                                {(appt.seriesId || (appt.recurrenceRule && appt.recurrenceRule !== "NONE")) && (
                                  <Repeat className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                )}
                                <span className="truncate">{appt.client?.name || appt.title}</span>
                              </span>
                              <span className="font-mono font-bold shrink-0 text-[9px]">
                                ${Number(appt.price).toFixed(0)}
                              </span>
                            </button>
                          ))}
                          {dayAppts.length > 3 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandDay(key);
                              }}
                              className="text-[9px] text-indigo-600 hover:text-indigo-800 font-bold px-1.5 py-0.5 text-left transition-colors cursor-pointer rounded hover:bg-indigo-50/80 w-fit flex items-center gap-0.5 mt-0.5"
                            >
                              {isExpanded ? "Ver menos ↑" : `+${dayAppts.length - 3} mais (ver todos)`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VISÃO 2: SEMANA (GRADE DE 7 COLUNAS) */}
            {viewMode === "week" && (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Semana: {weekDays[0].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} até{" "}
                      {weekDays[6].toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWeekOffset((p) => p - 1)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                      title="Semana anterior"
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
                      title="Próxima semana"
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
                        onClick={() => openNewAppointmentOnDate(key)}
                        title="Clique em uma área em branco para criar um novo agendamento neste dia"
                        className={`group rounded-2xl p-3 border flex flex-col gap-2 min-h-[300px] cursor-pointer transition-colors ${
                          isToday
                            ? "bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-500/20"
                            : "bg-slate-50/50 border-slate-200/80 hover:border-indigo-300"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                              {WEEKDAY_LABELS[day.getDay()]}
                            </span>
                            <span
                              className={`text-base font-black ${
                                isToday ? "text-indigo-600" : "text-slate-800"
                              }`}
                            >
                              {day.getDate()}
                            </span>
                          </div>
                          {isToday ? (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold">
                              Hoje
                            </span>
                          ) : (
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">
                              +
                            </span>
                          )}
                        </div>

                        <div className="flex-1 space-y-2">
                          {dayAppts.length === 0 ? (
                            <div className="text-center py-8 text-[11px] text-slate-400 italic">
                              Sem atendimentos (clique p/ agendar)
                            </div>
                          ) : (
                            dayAppts.map((appt) => (
                              <div
                                key={appt.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(appt);
                                }}
                                className="p-2 rounded-xl bg-white border border-slate-200/80 text-left hover:shadow-xs transition-shadow cursor-pointer space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-slate-500 font-semibold">
                                    {formatTime(appt.startTime)}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-emerald-600">
                                    ${Number(appt.price).toFixed(0)}
                                  </span>
                                </div>
                                <h5 className="font-bold text-xs text-slate-900 truncate flex items-center gap-1">
                                  {(appt.seriesId || (appt.recurrenceRule && appt.recurrenceRule !== "NONE")) && (
                                    <Repeat className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                  )}
                                  <span className="truncate">{appt.client?.name || appt.title}</span>
                                </h5>
                                <p className="text-[10px] text-indigo-600 truncate">{appt.title}</p>
                                {Array.isArray(appt.professionals) && appt.professionals.length > 0 && (
                                  <div className="text-[9px] font-bold text-slate-500 truncate flex items-center gap-1 pt-0.5">
                                    <Users className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                    <span className="truncate">
                                      {appt.professionals.map((p: any) => p.name).join(" & ")}
                                    </span>
                                  </div>
                                )}
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

            {/* VISÃO 3: HOJE (LISTA OPERACIONAL DO DIA) */}
            {viewMode === "today" && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Atendimentos Programados para Hoje
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date().toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                    {todayAppointments.length} atendimento(s)
                  </span>
                </div>

                {todayAppointments.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
                    <Sun className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <h4 className="font-bold text-slate-700 text-sm">Nenhum atendimento para hoje</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Não há limpezas programadas no calendário para o dia de hoje. Você pode criar um novo agendamento ou alternar para a visão Semanal/Mensal.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todayAppointments.map((appt) => renderAppointmentCard(appt))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: GRADE DE ATENDIMENTO & CAPACIDADE */}
        {activeTab === "operating_hours" && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Grade de Horários Semanais & Capacidade Operacional
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina os dias ativos da semana, horários de atendimento, margem de trânsito e duração operacional.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSchedule(DEFAULT_SCHEDULE);
                      setRouteParams({
                        travelBufferMinutes: 10,
                        standardMin: "1h45",
                        standardMax: "2h30",
                        deepMin: "4h00",
                        deepMax: "6h00",
                      });
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                  <button
                    onClick={handleSaveSchedule}
                    disabled={savingSchedule}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {savingSchedule ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{saveSuccess ? "Salvo com Sucesso!" : "Salvar Configurações"}</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 overflow-x-auto">
                {schedule.map((day) => (
                  <div
                    key={day.dayId}
                    className={`py-4 px-2 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors rounded-xl ${
                      day.isOpen ? "hover:bg-slate-50/70" : "bg-slate-50/40 opacity-75"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-[200px]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={day.isOpen}
                          onChange={(e) => handleDayChange(day.dayId, "isOpen", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>

                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{day.dayName}</h4>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            day.isOpen
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {day.isOpen ? "Aberto / Ativo" : "Fechado"}
                        </span>
                      </div>
                    </div>

                    {day.isOpen ? (
                      <div className="flex flex-wrap items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">Horário:</span>
                          <input
                            type="time"
                            value={day.startTime}
                            onChange={(e) => handleDayChange(day.dayId, "startTime", e.target.value)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-400">até</span>
                          <input
                            type="time"
                            value={day.endTime}
                            onChange={(e) => handleDayChange(day.dayId, "endTime", e.target.value)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">Capacidade:</span>
                          <select
                            value={day.maxCapacity}
                            onChange={(e) => handleDayChange(day.dayId, "maxCapacity", Number(e.target.value))}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value={1}>1 Atendimento / dia</option>
                            <option value={2}>2 Atendimentos / dia</option>
                            <option value={3}>3 Atendimentos / dia (Ideal)</option>
                            <option value={4}>4 Atendimentos / dia (Máx)</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">Região:</span>
                          <input
                            type="text"
                            value={day.preferredCity}
                            onChange={(e) => handleDayChange(day.dayId, "preferredCity", e.target.value)}
                            placeholder="Ex: Evans, Greeley..."
                            className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 text-xs text-slate-400 italic">
                        Dia reservado para folga ou descanso.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SEÇÃO: PARÂMETROS DE ROTA, MARGEM DE TRÂNSITO & MÉDIA OPERACIONAL (DE -> ATÉ) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Parâmetros de Rota, Trânsito & Média Operacional
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure a margem de segurança no trânsito e parametrize o tempo médio operacional de cada tipo de limpeza
                  </p>
                </div>
              </div>

              {/* Box explicativo da regra de rotas */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/70 text-xs text-indigo-950 space-y-1.5 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <span>🚗 Como o cálculo de rotas protege o seu dia:</span>
                </div>
                <p>
                  Ao analisar um espaço livre na agenda (ex: entre um atendimento em <strong>Timnath</strong> e outro em <strong>Greeley</strong>), o sistema calcula o tempo real de deslocamento de carro até o novo cliente + a duração da faxina + a rota até o próximo cliente. Se o trajeto exceder o tempo disponível na grade acima, o horário é bloqueado automaticamente para garantir a pontualidade.
                </p>
              </div>

              {/* Margem de Segurança no Trânsito */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-slate-800 font-bold">
                    🚦 Margem de Segurança no Trânsito
                  </label>
                  <select
                    value={
                      Number.isFinite(routeParams.travelBufferMinutes)
                        ? routeParams.travelBufferMinutes
                        : 10
                    }
                    onChange={(e) =>
                      setRouteParams((prev) => ({
                        ...prev,
                        travelBufferMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                  >
                    <option value={5}>+5 minutos de tolerância</option>
                    <option value={10}>+10 minutos de tolerância (Recomendado)</option>
                    <option value={15}>+15 minutos de tolerância</option>
                    <option value={20}>+20 minutos de tolerância</option>
                    <option value={30}>+30 minutos de tolerância</option>
                  </select>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    Margem extra adicionada ao tempo de GPS entre clientes para estacionamento e imprevistos.
                  </span>
                </div>

                {/* Standard Cleaning (Média Operacional) De -> Até */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div>
                    <span className="font-bold text-slate-800 block">
                      🧹 Standard Cleaning (Média Operacional)
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Parametrização de tempo médio operacional (De → Até)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        De (Mínimo)
                      </label>
                      <input
                        type="text"
                        value={routeParams.standardMin}
                        onChange={(e) =>
                          setRouteParams((prev) => ({ ...prev, standardMin: e.target.value }))
                        }
                        placeholder="Ex: 1h45"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                    <span className="text-slate-400 font-bold pt-4">→</span>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Até (Máximo)
                      </label>
                      <input
                        type="text"
                        value={routeParams.standardMax}
                        onChange={(e) =>
                          setRouteParams((prev) => ({ ...prev, standardMax: e.target.value }))
                        }
                        placeholder="Ex: 2h30"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 block">
                    Ex: <strong>{routeParams.standardMin || "1h45"}</strong> até{" "}
                    <strong>{routeParams.standardMax || "2h30"}</strong> conforme banheiros, quartos e metragem.
                  </span>
                </div>

                {/* Deep Cleaning & Move-Out (Média Operacional) De -> Até */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div>
                    <span className="font-bold text-slate-800 block">
                      ✨ Deep Cleaning & Move-Out (Média Operacional)
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Parametrização de tempo médio operacional (De → Até)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        De (Mínimo)
                      </label>
                      <input
                        type="text"
                        value={routeParams.deepMin}
                        onChange={(e) =>
                          setRouteParams((prev) => ({ ...prev, deepMin: e.target.value }))
                        }
                        placeholder="Ex: 4h00"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                    <span className="text-slate-400 font-bold pt-4">→</span>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Até (Máximo)
                      </label>
                      <input
                        type="text"
                        value={routeParams.deepMax}
                        onChange={(e) =>
                          setRouteParams((prev) => ({ ...prev, deepMax: e.target.value }))
                        }
                        placeholder="Ex: 6h00"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 block">
                    Ex: <strong>{routeParams.deepMin || "4h00"}</strong> até{" "}
                    <strong>{routeParams.deepMax || "6h00"}</strong> para limpeza pesada e mudança.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        appointment={editingAppointment}
        initialDate={newAppointmentDate}
        onClose={() => {
          setIsAppointmentModalOpen(false);
          setEditingAppointment(null);
          setNewAppointmentDate(null);
        }}
        onSuccess={() => {
          fetchAppointments(false);
        }}
      />

      {/* Agenda Invoice Modal (+ Invoice) */}
      <AgendaInvoiceModal
        isOpen={isAgendaInvoiceModalOpen}
        onClose={() => setIsAgendaInvoiceModalOpen(false)}
        appointments={appointments}
        initialMonthDate={monthCursor}
        onInvoiceCreated={() => {
          fetchAppointments(false);
        }}
      />
    </div>
  );
}
