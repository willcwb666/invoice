"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import {
  Calendar as CalendarIcon,
  Clock,
  Save,
  CheckCircle2,
  Smartphone,
  Copy,
  Check,
  Plus,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Sparkles,
} from "lucide-react";
import { AppointmentModal } from "@/components/ui/appointment-modal";
import { motion, AnimatePresence } from "framer-motion";

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

interface Appointment {
  id: string;
  title: string;
  date: string;
  startTime: string;
  price: number | string;
  client?: { name: string };
}

export default function AgendaPage() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  // Webcal token comes only from the authenticated /api/v1/agenda/sync
  // response — never hardcoded, since it doubles as an unauthenticated
  // bypass secret for the outbound calendar feed.
  const [webcalToken, setWebcalToken] = useState<string | null>(null);

  // Selected week offset for the live calendar view (0 = current week)
  const [weekOffset, setWeekOffset] = useState(0);

  // Load schedule from localStorage or fallback
  useEffect(() => {
    try {
      const saved = localStorage.getItem("invoice_weekly_schedule");
      if (saved) {
        setSchedule(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

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
    fetch("/api/v1/agenda/sync")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setWebcalToken(data.webcalToken || null))
      .catch(() => {});
  }, []);

  const handleSaveSchedule = () => {
    setSaving(true);
    try {
      localStorage.setItem("invoice_weekly_schedule", JSON.stringify(schedule));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Erro ao salvar agenda semanal:", e);
    } finally {
      setSaving(false);
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

  // Calculate current week dates
  const weekDays = useMemo(() => {
    const today = new Date();
    // Monday of current week
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekOffset]);

  // Appointments grouped by date in the selected week
  const weekAppointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const appt of appointments) {
      const dateStr = new Date(appt.date).toISOString().slice(0, 10);
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(appt);
    }
    return map;
  }, [appointments]);

  // Total weekly capacity
  const weeklyCapacity = useMemo(() => {
    return schedule.reduce((acc, d) => acc + (d.isOpen ? Number(d.maxCapacity || 0) : 0), 0);
  }, [schedule]);

  const openDaysCount = useMemo(() => {
    return schedule.filter((d) => d.isOpen).length;
  }, [schedule]);

  const copyFeedUrl = () => {
    if (!webcalToken || typeof window === "undefined") return;
    const webcalUrl = `${window.location.origin.replace(/^https?:/, "webcal:")}/api/v1/agenda/feed.ics?token=${webcalToken}`;
    navigator.clipboard.writeText(webcalUrl);
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 3000);
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Agenda Semanal & Horários de Funcionamento"
        subtitle="Configuração de dias de atendimento, horários de funcionamento e capacidade de serviços"
        onRefresh={fetchAppointments}
        loading={loading}
        actionSlot={
          <button
            onClick={handleSaveSchedule}
            disabled={saving}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saveSuccess ? "Salvo com Sucesso!" : "Salvar Horários"}</span>
          </button>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Success Alert */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Horários de funcionamento da semana atualizados com sucesso!</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium">Sincronizado</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Weekly Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Dias de Operação</span>
              <CalendarIcon className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {openDaysCount} <span className="text-sm font-normal text-slate-400">/ 7 dias</span>
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              Segunda a Sexta (Padrão)
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold">
              <span>Capacidade Semanal</span>
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-600 mt-2">
              {weeklyCapacity}{" "}
              <span className="text-sm font-normal text-slate-400">limpezas/semana</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Média de 2 a 3 por dia útil</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
              <span>Horário de Funcionamento</span>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xl font-black text-slate-900 mt-2">08:00 - 17:00</p>
            <p className="text-[11px] text-slate-500 mt-1">Horário das Montanhas (Denver/CO)</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Regiões Atendidas</span>
              <MapPin className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-xl font-black text-slate-900 mt-2">Greeley & Evans</p>
            <p className="text-[11px] text-slate-500 mt-1">Condado de Weld, Colorado</p>
          </div>
        </div>

        {/* iCloud iPhone Synchronization Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-white/10 text-indigo-300 backdrop-blur-sm shrink-0 border border-white/10">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Sincronização com iPhone da Renata</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  Ao Vivo
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                A agenda semanal sincroniza automaticamente com o aplicativo <strong>Calendário nativo do iPhone</strong>.
                Qualquer evento adicionado com horários de início e término aparece instantaneamente na grade operacional.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyFeedUrl}
              disabled={!webcalToken}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all border border-white/15 cursor-pointer backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={webcalToken ? "Copiar URL do feed iCal" : "Configure WEBCAL_SECRET no servidor para habilitar"}
            >
              {copiedFeed ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span>{copiedFeed ? "Link Copiado!" : "Copiar Feed do iPhone"}</span>
            </button>

            <Link
              href="/appointments"
              className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-md shadow-indigo-600/30"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Ver Atendimentos</span>
            </Link>
          </div>
        </div>

        {/* Section 1: Weekly Days & Operating Hours Configuration Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Grade de Horários Semanais de Funcionamento
              </h3>
              <p className="text-xs text-slate-500">
                Defina o status de abertura, janela de horário e capacidade de atendimentos para cada dia da semana.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSchedule(DEFAULT_SCHEDULE)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Restaurar Padrão
              </button>
              <button
                onClick={handleSaveSchedule}
                disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Grade</span>
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
                {/* Day status toggle & name */}
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

                {/* Operating hours inputs */}
                {day.isOpen ? (
                  <div className="flex flex-wrap items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Horário:</span>
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) =>
                          handleDayChange(day.dayId, "startTime", e.target.value)
                        }
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
                        onChange={(e) =>
                          handleDayChange(day.dayId, "maxCapacity", Number(e.target.value))
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={1}>1 Atendimento / dia</option>
                        <option value={2}>2 Atendimentos / dia</option>
                        <option value={3}>3 Atendimentos / dia (Ideal)</option>
                        <option value={4}>4 Atendimentos / dia (Máx)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Região / Rota:</span>
                      <input
                        type="text"
                        value={day.preferredCity}
                        onChange={(e) =>
                          handleDayChange(day.dayId, "preferredCity", e.target.value)
                        }
                        placeholder="Ex: Evans, Greeley..."
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 text-xs text-slate-400 italic">
                    Não há atendimentos programados para este dia. (Dia reservado para folga ou tarefas internas).
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Visual Weekly Calendar with Current Appointments */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                <span>Visão Semanal Integrada da Agenda</span>
              </h3>
              <p className="text-xs text-slate-500">
                Atendimentos da semana sincronizados entre a base de clientes e o iPhone.
              </p>
            </div>

            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((prev) => prev - 1)}
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
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Próxima semana"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsAppointmentModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer ml-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agendar</span>
              </button>
            </div>
          </div>

          {/* 7-column Week Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((dayDate) => {
              const dateKey = dayDate.toISOString().slice(0, 10);
              const dayOfWeek = dayDate.getDay();
              const config = schedule.find((s) => s.dayId === dayOfWeek);
              const dayAppts = weekAppointmentsByDate[dateKey] || [];
              const isToday = new Date().toISOString().slice(0, 10) === dateKey;

              return (
                <div
                  key={dateKey}
                  className={`rounded-2xl p-3.5 border flex flex-col justify-between min-h-[220px] transition-all ${
                    isToday
                      ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-500/20 shadow-xs"
                      : config?.isOpen
                      ? "bg-white border-slate-200/80"
                      : "bg-slate-50/60 border-slate-200/50"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-bold uppercase text-slate-500 block">
                          {dayDate.toLocaleDateString("pt-BR", { weekday: "short" })}
                        </span>
                        <span
                          className={`text-base font-black ${
                            isToday ? "text-indigo-600" : "text-slate-900"
                          }`}
                        >
                          {dayDate.getDate()}
                        </span>
                      </div>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-bold">
                          Hoje
                        </span>
                      )}
                    </div>

                    {/* Hours badge */}
                    <div className="mt-2">
                      {config?.isOpen ? (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {config.startTime} - {config.endTime}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Fechado</span>
                      )}
                    </div>

                    {/* Appointments for this day */}
                    <div className="mt-3 space-y-2">
                      {dayAppts.length === 0 ? (
                        <div className="text-[10px] text-slate-400 italic text-center py-4">
                          {config?.isOpen ? "Disponível" : "Sem horário"}
                        </div>
                      ) : (
                        dayAppts.map((appt) => (
                          <div
                            key={appt.id}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors"
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
                              {new Date(appt.startTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Slot availability summary */}
                  {config?.isOpen && (
                    <div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-medium">
                        {dayAppts.length}/{config.maxCapacity} vagas
                      </span>
                      {dayAppts.length >= config.maxCapacity ? (
                        <span className="text-amber-600 font-bold">Lotado</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">Disponível</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
