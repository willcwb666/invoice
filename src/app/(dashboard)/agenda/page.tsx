"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

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

  return (
    <div>
      <Header
        title="Agenda Inteligente (iCloud / iPhone)"
        subtitle="Atendimentos sincronizados com o calendário da sua esposa"
        onRefresh={fetchAppointments}
        loading={loading}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Banner de Sincronização com o iPhone */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Sincronização Ativa com o iPhone da Esposa</h3>
              <p className="text-xs text-slate-500">
                Qualquer limpeza marcada no app Calendário do iPhone aparece aqui com rota GPS e valor negociado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-mono text-slate-700">
              Feed WebCal: webcal://invoice.local/feed.ics
            </span>
          </div>
        </div>

        {/* Lista de Atendimentos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appointments.length === 0 ? (
            <div className="col-span-2 p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Nenhum agendamento encontrado no momento.
            </div>
          ) : (
            appointments.map((appt) => (
              <div
                key={appt.id}
                className="p-5 rounded-2xl bg-white border border-slate-200/80 flex flex-col justify-between gap-4 shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 block">{appt.title}</span>
                    <h4 className="font-bold text-slate-900 text-base">{appt.client?.name}</h4>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {new Date(appt.date).toLocaleDateString("pt-BR")} •{" "}
                        {new Date(appt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-lg font-black text-emerald-600 block">
                      ${Number(appt.price).toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                        appt.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {appt.status}
                    </span>
                    {appt.status !== "COMPLETED" && (
                      <button
                        onClick={() => handleCompleteAppointment(appt.id)}
                        className="mt-2 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold inline-flex items-center gap-1 transition-colors border border-emerald-200"
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
                      <span className="truncate">{appt.location}</span>
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
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(appt.location)}`}
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
      </div>
    </div>
  );
}
