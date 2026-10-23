"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { SmartNavigationButton } from "@/components/ui/smart-navigation-button";
import { ChecklistModal } from "@/components/cleaner/checklist-modal";
import { PhotoModal } from "@/components/cleaner/photo-modal";
import { EnRouteModal } from "@/components/cleaner/en-route-modal";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Key,
  Bell,
  Shield,
  Car,
  CheckCircle2,
  Play,
  Camera,
  CheckSquare,
  Navigation,
  Sparkles,
  Users,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  Zap,
  Route,
  ArrowRight,
} from "lucide-react";

interface CleanerAppointment {
  id: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  status: "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  services: Array<{ name: string; price?: number }>;
  client: {
    id: string;
    name: string;
    phone: string | null;
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  access: {
    entryCode: string | null;
    alarmCode: string | null;
    pets: string | null;
    parkingInstructions: string | null;
  };
  checklists: Array<{
    id: string;
    room: string;
    title: string;
    completed: boolean;
  }>;
  photos: Array<{
    id: string;
    photoType: "BEFORE" | "AFTER";
    photoUrl: string;
  }>;
  team: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
}

interface WeatherInfo {
  city: string;
  tempCurrent: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  condition: string;
  icon: "sun" | "cloud" | "rain" | "snow" | "thunder";
  warning?: string | null;
}

function getDenverTodayDateString(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return date.toISOString().split("T")[0];
}

export default function CleanerPortalPage() {
  const { user, isCleaner, isAdmin, isOperator } = useCurrentUser();
  const [selectedDate, setSelectedDate] = useState(() => getDenverTodayDateString());
  const [selectedCleanerId, setSelectedCleanerId] = useState<string>("all");
  const [allProfessionals, setAllProfessionals] = useState<
    Array<{ id: string; name: string; isOwner: boolean; color: string | null }>
  >([]);
  const [currentProfessional, setCurrentProfessional] = useState<{
    id: string;
    name: string;
    isOwner: boolean;
  } | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [appointments, setAppointments] = useState<CleanerAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    fetch("/api/v1/weather")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) setWeather(j.data);
      })
      .catch(() => {});
  }, []);

  // Active Modals
  const [activeChecklistAppt, setActiveChecklistAppt] = useState<CleanerAppointment | null>(null);
  const [activePhotoAppt, setActivePhotoAppt] = useState<CleanerAppointment | null>(null);
  const [activeEnRouteAppt, setActiveEnRouteAppt] = useState<CleanerAppointment | null>(null);

  const fetchCleanerData = useCallback(async (dateStr: string, cleanerId?: string) => {
    setLoading(true);
    try {
      const activeCleanerId = cleanerId !== undefined ? cleanerId : selectedCleanerId;
      const params = new URLSearchParams({ date: dateStr });
      if (activeCleanerId && activeCleanerId !== "all") {
        params.set("cleanerId", activeCleanerId);
      }
      const res = await fetch(`/api/v1/cleaner/appointments?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setAppointments(json.data || []);
        if (Array.isArray(json.allProfessionals)) {
          setAllProfessionals(json.allProfessionals);
        }
        if (json.professional) {
          setCurrentProfessional(json.professional);
        }
        if (json.isAdminView !== undefined) {
          setIsAdminView(json.isAdminView);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar atendimentos da diarista:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCleanerId]);

  useEffect(() => {
    fetchCleanerData(selectedDate, selectedCleanerId);
  }, [selectedDate, selectedCleanerId, fetchCleanerData]);

  const handleDateChange = (daysOffset: number) => {
    setSelectedDate((prev) => offsetDate(prev, daysOffset));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleUpdateStatus = async (apptId: string, nextStatus: "IN_PROGRESS" | "COMPLETED") => {
    setUpdatingId(apptId);
    try {
      const res = await fetch(`/api/v1/cleaner/appointments/${apptId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === apptId ? { ...a, status: nextStatus } : a))
        );
      }
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const todayStr = getDenverTodayDateString();
  const tomorrowStr = offsetDate(todayStr, 1);

  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;
  const inProgressCount = appointments.filter((a) => a.status === "IN_PROGRESS").length;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 md:pb-12 text-slate-900">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3.5 shadow-2xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-900">Portal da Diarista</h1>
              <p className="text-[11px] text-teal-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                {currentProfessional?.name || user?.name || "Colaboradora"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchCleanerData(selectedDate, selectedCleanerId)}
            className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            title="Atualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Cleaner / Route Selector for Admins & Operators */}
        {allProfessionals.length > 0 && (isAdmin || isOperator || isAdminView) && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Users className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Colaboradora / Roteiro:</span>
            </div>
            <select
              value={selectedCleanerId}
              onChange={(e) => setSelectedCleanerId(e.target.value)}
              className="text-xs font-bold text-teal-900 bg-teal-50 border border-teal-200 rounded-xl px-3 py-1.5 focus:outline-hidden cursor-pointer"
            >
              <option value="all">⭐ Minhas Casas / Todas</option>
              {allProfessionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isOwner ? "(Titular)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Selector Navigation */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleDateChange(-1)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedDate === todayStr
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(tomorrowStr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedDate === tomorrowStr
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Amanhã
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleDateChange(1)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
              aria-label="Próximo dia"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              {new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-teal-700 bg-transparent border-0 cursor-pointer focus:outline-hidden"
            />
          </div>
        </div>

        {/* Weather Forecast Card (Evans / Greeley, CO) */}
        {weather && (
          <div className="bg-gradient-to-r from-sky-50 via-teal-50/60 to-emerald-50 rounded-2xl border border-sky-200/80 p-3.5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white text-sky-600 flex items-center justify-center shadow-xs border border-sky-100">
                  {weather.icon === "sun" ? (
                    <Sun className="w-5 h-5 text-amber-500" />
                  ) : weather.icon === "snow" ? (
                    <Snowflake className="w-5 h-5 text-sky-500 animate-pulse" />
                  ) : weather.icon === "rain" ? (
                    <CloudRain className="w-5 h-5 text-blue-500" />
                  ) : weather.icon === "thunder" ? (
                    <Zap className="w-5 h-5 text-amber-500" />
                  ) : (
                    <Cloud className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900">{weather.city}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 font-bold">
                      {weather.condition}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Máx: <strong>{weather.tempMax}°F</strong> • Mín: <strong>{weather.tempMin}°F</strong>
                    {weather.precipitationProbability > 0 && ` • 🌧️ ${weather.precipitationProbability}% chuva`}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  {weather.tempCurrent}°F
                </span>
                <span className="block text-[10px] font-semibold text-slate-500 uppercase">Agora</span>
              </div>
            </div>

            {weather.warning && (
              <div className="p-2 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-900 text-[11px] font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>{weather.warning}</span>
              </div>
            )}
          </div>
        )}

        {/* Route Flow (Ordem das Casas do Dia) */}
        {appointments.length > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Route className="w-3.5 h-3.5 text-teal-600" />
              Trajeto & Ordem de Atendimento
            </span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {appointments.map((a, i) => (
                <React.Fragment key={a.id}>
                  <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="w-4 h-4 rounded-full bg-teal-600 text-white font-bold text-[9px] flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="font-bold text-slate-800 truncate max-w-[90px]">{a.client.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({a.timeStart})</span>
                  </div>
                  {i < appointments.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Day Stats Pill */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
            <span className="text-base font-black text-slate-800">{appointments.length} Casas</span>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-amber-500 block">Em Andamento</span>
            <span className="text-base font-black text-amber-600">{inProgressCount}</span>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-emerald-500 block">Concluídas</span>
            <span className="text-base font-black text-emerald-600">{completedCount}</span>
          </div>
        </div>

        {/* Appointments List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="text-xs font-semibold">Carregando roteiro do dia...</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6 space-y-2">
            <Sparkles className="w-10 h-10 text-teal-500 mx-auto" />
            <h3 className="font-bold text-sm text-slate-800">Nenhum atendimento escalado</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Você não possui casas agendadas para esta data. Selecione outro dia no calendário acima.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appt, idx) => {
              const hasAccessInfo =
                appt.access.entryCode ||
                appt.access.alarmCode ||
                appt.access.pets ||
                appt.access.parkingInstructions;

              const isCompleted = appt.status === "COMPLETED";
              const isInProgress = appt.status === "IN_PROGRESS";

              const checklistTotal = appt.checklists.length;
              const checklistDone = appt.checklists.filter((c) => c.completed).length;

              return (
                <div
                  key={appt.id}
                  className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                    isInProgress
                      ? "border-teal-400 ring-2 ring-teal-100"
                      : isCompleted
                      ? "border-slate-200 opacity-90"
                      : "border-slate-200/90"
                  }`}
                >
                  {/* Card Header: Time & Status */}
                  <div
                    className={`px-4 py-3 flex items-center justify-between border-b ${
                      isInProgress
                        ? "bg-teal-50/60 border-teal-100"
                        : isCompleted
                        ? "bg-slate-50/60 border-slate-100"
                        : "bg-slate-50/40 border-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-black text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        <span>
                          {appt.timeStart} - {appt.timeEnd}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide border ${
                        isCompleted
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : isInProgress
                          ? "bg-teal-50 text-teal-700 border-teal-300 animate-pulse"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {isCompleted ? "Concluído ✓" : isInProgress ? "Em Andamento" : "Agendado"}
                    </span>
                  </div>

                  {/* Client & Navigation Details */}
                  <div className="p-4 space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-black text-base text-slate-900 leading-tight">
                          {appt.client.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="leading-snug">
                            {appt.client.address}
                            {appt.client.city ? `, ${appt.client.city}` : ""}
                          </span>
                        </div>
                      </div>

                      {/* Phone action */}
                      {appt.client.phone && (
                        <a
                          href={`tel:${appt.client.phone}`}
                          aria-label={`Ligar para ${appt.client.name}`}
                          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {/* Universal GPS Navigation Button */}
                    <SmartNavigationButton
                      address={appt.client.address}
                      city={appt.client.city || undefined}
                      state={appt.client.state || undefined}
                      variant="full"
                      className="w-full justify-center"
                    />

                    {/* Structured Property Access Box */}
                    {hasAccessInfo && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Key className="w-3 h-3 text-slate-500" />
                          Instruções de Acesso à Residência
                        </span>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {appt.access.entryCode && (
                            <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Portão / Lockbox</span>
                                <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                                  {appt.access.entryCode}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(appt.access.entryCode!, `${appt.id}_entry`)}
                                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                title="Copiar código"
                              >
                                {copiedKey === `${appt.id}_entry` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}

                          {appt.access.alarmCode && (
                            <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Código Alarme</span>
                                <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                                  {appt.access.alarmCode}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(appt.access.alarmCode!, `${appt.id}_alarm`)}
                                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                title="Copiar alarme"
                              >
                                {copiedKey === `${appt.id}_alarm` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {appt.access.pets && (
                          <div className="p-2 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="font-medium">
                              <strong>Pets na casa:</strong> {appt.access.pets}
                            </span>
                          </div>
                        )}

                        {appt.access.parkingInstructions && (
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs flex items-center gap-2">
                            <Car className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="font-medium">
                              <strong>Estacionamento:</strong> {appt.access.parkingInstructions}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Services Badges */}
                    {appt.services && appt.services.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {appt.services.map((svc, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100"
                          >
                            {svc.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Team Members */}
                    {appt.team && appt.team.length > 1 && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Equipe escalada:</span>
                        <div className="flex items-center gap-1">
                          {appt.team.map((t) => (
                            <span
                              key={t.id}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Internal Notes */}
                    {appt.notes && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed">
                        <strong className="text-slate-900">Observações:</strong> {appt.notes}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                      {/* ETA Alert Button */}
                      <button
                        type="button"
                        onClick={() => setActiveEnRouteAppt(appt)}
                        className="py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Navigation className="w-4 h-4 text-slate-600" />
                        <span className="truncate">A Caminho</span>
                      </button>

                      {/* Checklist Button */}
                      <button
                        type="button"
                        onClick={() => setActiveChecklistAppt(appt)}
                        className="py-2.5 px-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200/80 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <CheckSquare className="w-4 h-4 text-teal-600" />
                        <span className="truncate">Checklist</span>
                      </button>

                      {/* Photo Button */}
                      <button
                        type="button"
                        onClick={() => setActivePhotoAppt(appt)}
                        className="py-2.5 px-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200/80 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Camera className="w-4 h-4 text-indigo-600" />
                        <span className="truncate">Fotos</span>
                      </button>
                    </div>

                    {/* Primary Status Toggle Button */}
                    <div className="pt-1">
                      {isCompleted ? (
                        <div className="w-full py-3 px-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Atendimento Concluído com Sucesso</span>
                        </div>
                      ) : isInProgress ? (
                        <button
                          type="button"
                          disabled={updatingId === appt.id}
                          onClick={() => handleUpdateStatus(appt.id, "COMPLETED")}
                          className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-200 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                        >
                          {updatingId === appt.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>✓ Finalizar Limpeza da Casa</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={updatingId === appt.id}
                          onClick={() => handleUpdateStatus(appt.id, "IN_PROGRESS")}
                          className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-md shadow-teal-200 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                        >
                          {updatingId === appt.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          <span>▶ Iniciar Limpeza</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Checklist Modal */}
      {activeChecklistAppt && (
        <ChecklistModal
          appointmentId={activeChecklistAppt.id}
          clientName={activeChecklistAppt.client.name}
          onClose={() => setActiveChecklistAppt(null)}
        />
      )}

      {/* Photo Modal */}
      {activePhotoAppt && (
        <PhotoModal
          appointmentId={activePhotoAppt.id}
          clientName={activePhotoAppt.client.name}
          onClose={() => setActivePhotoAppt(null)}
        />
      )}

      {/* En-Route Modal */}
      {activeEnRouteAppt && (
        <EnRouteModal
          appointmentId={activeEnRouteAppt.id}
          clientName={activeEnRouteAppt.client.name}
          clientAddress={activeEnRouteAppt.client.address}
          onClose={() => setActiveEnRouteAppt(null)}
        />
      )}
    </div>
  );
}
