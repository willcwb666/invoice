"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  UserPlus,
  AlertCircle,
  Loader2,
  Check,
  Wrench,
} from "lucide-react";
import { ClientModal } from "@/components/ui/client-modal";
import { useToast } from "@/components/ui/toast";

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** When provided, the modal edits this existing appointment instead of creating a new one. */
  appointment?: any | null;
}

interface ServiceOption {
  id: string;
  name: string;
  type: "STANDARD" | "EXTRA";
  basePrice: number | string;
  defaultDurationMinutes: number;
}

type AppointmentStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "SCHEDULED", label: "Agendado" },
  { value: "IN_PROGRESS", label: "Em Andamento" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
];

export function AppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  appointment,
}: AppointmentModalProps) {
  const { showToast } = useToast();
  const isEditing = Boolean(appointment);

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [autoTitle, setAutoTitle] = useState(""); // last title we auto-generated, so we don't clobber a manual edit
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("SCHEDULED");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/v1/clients");
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar clientes:", e);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await fetch("/api/v1/services");
      if (res.ok) {
        const json = await res.json();
        setServices(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar serviços:", e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchClients();
    fetchServices();
    setError(null);

    if (appointment) {
      setSelectedClientId(appointment.clientId || appointment.client?.id || "");
      const apptServiceIds: string[] = (appointment.services || [])
        .map((as: any) => as.service?.id || as.serviceId)
        .filter(Boolean);
      setSelectedServiceIds(apptServiceIds);
      setAutoTitle("");
      setTitle(appointment.title || "");
      setDate(new Date(appointment.date).toISOString().slice(0, 10));
      setStartTime(new Date(appointment.startTime).toISOString().slice(11, 16));
      setEndTime(new Date(appointment.endTime).toISOString().slice(11, 16));
      setLocation(appointment.location || "");
      setPrice(Number(appointment.price) || 0);
      setNotes(appointment.notes || "");
      setStatus((appointment.status as AppointmentStatus) || "SCHEDULED");
    } else {
      setSelectedClientId("");
      setSelectedServiceIds([]);
      setAutoTitle("");
      setTitle("");
      setDate(new Date().toISOString().slice(0, 10));
      setStartTime("09:00");
      setEndTime("12:00");
      setLocation("");
      setPrice(0);
      setNotes("");
      setStatus("SCHEDULED");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, appointment]);

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const found = clients.find((c) => c.id === clientId);
    if (found?.address) {
      const fullAddr = `${found.address}${found.city ? ` - ${found.city}` : ""}${
        found.state ? `, ${found.state}` : ""
      }${found.zipCode ? ` ${found.zipCode}` : ""}`;
      setLocation(fullAddr);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) => {
      const next = prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId];

      const selected = services.filter((s) => next.includes(s.id));
      const sumPrice = selected.reduce((acc, s) => acc + Number(s.basePrice), 0);
      const sumMinutes = selected.reduce((acc, s) => acc + (s.defaultDurationMinutes || 0), 0);

      setPrice(sumPrice);

      if (sumMinutes > 0) {
        const [h, m] = startTime.split(":").map(Number);
        const endMinutesTotal = h * 60 + m + sumMinutes;
        const endH = Math.min(23, Math.floor(endMinutesTotal / 60));
        const endM = endMinutesTotal % 60;
        setEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
      }

      const generatedTitle = selected.map((s) => s.name).join(" + ");
      if (!title || title === autoTitle) {
        setTitle(generatedTitle);
        setAutoTitle(generatedTitle);
      }

      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError("Por favor, selecione ou cadastre um cliente.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startDateTime = new Date(`${date}T${startTime}:00Z`).toISOString();
      const endDateTime = new Date(`${date}T${endTime}:00Z`).toISOString();
      const dateOnly = new Date(`${date}T00:00:00Z`).toISOString();

      const payload: Record<string, unknown> = {
        clientId: selectedClientId,
        serviceIds: selectedServiceIds,
        title,
        date: dateOnly,
        startTime: startDateTime,
        endTime: endDateTime,
        location: location || null,
        price: Number(price),
        notes: notes || null,
      };

      if (isEditing) {
        payload.status = status;
      } else {
        payload.origin = "INTERNAL";
      }

      const res = await fetch(
        isEditing ? `/api/v1/appointments/${appointment.id}` : "/api/v1/appointments",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || (isEditing ? "Falha ao salvar agendamento." : "Falha ao criar agendamento."));
      }

      showToast(isEditing ? "Agendamento atualizado com sucesso." : "Agendamento criado com sucesso.", "success");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao salvar o agendamento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {isEditing ? "Editar Agendamento" : "Novo Agendamento na Agenda"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isEditing
                        ? "Ajuste serviços, valores, horário ou status deste atendimento"
                        : "Sincroniza automaticamente com o iPhone e feed WebCal"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto pt-5 space-y-4 pr-1 text-xs"
              >
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Cliente Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700 block">
                      Cliente Atendido *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsClientModalOpen(true)}
                      className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Cadastrar Novo Cliente</span>
                    </button>
                  </div>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                  >
                    <option value="">Selecione um cliente cadastrado...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.address ? `(${c.address})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Service Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Serviços a Executar</span>
                    </label>
                    {selectedServiceIds.length > 0 && (
                      <span className="font-mono font-bold text-emerald-600 text-[11px]">
                        Total: ${price.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {services.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic p-2">
                      Nenhum serviço cadastrado ainda. Cadastre em "Serviços" no menu.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {services.map((s) => {
                        const checked = selectedServiceIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleService(s.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2 ${
                              checked
                                ? "bg-indigo-50 border-indigo-300 text-indigo-950"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div
                              className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
                              }`}
                            >
                              {checked && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-bold text-xs">{s.name}</span>
                                <span
                                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    s.type === "STANDARD"
                                      ? "bg-indigo-100 text-indigo-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {s.type === "STANDARD" ? "Std" : "Extra"}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-emerald-600 mt-0.5 font-bold">
                                ${Number(s.basePrice).toFixed(2)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Title */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">
                    Título Personalizado do Atendimento
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Ex: House - Standard Regular Cleaning"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                {/* Date & Times */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">
                      Data da Limpeza
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">
                      Horário de Início
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">
                      Horário de Término
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-mono"
                    />
                  </div>
                </div>

                {/* Price & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">
                      Valor Combinado ($ USD) *
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        required
                        className="w-full pl-8 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">
                      Endereço do Atendimento (GPS)
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Ex: 4172 MeadowView - Evans, CO"
                        className="w-full pl-8 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Status (só ao editar) */}
                {isEditing && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">
                    Observações Internas (Portão, Pet, etc.)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instruções de acesso, detalhes específicos do trabalho..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs resize-none"
                  />
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isEditing ? "Salvando..." : "Agendando..."}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{isEditing ? "Salvar Alterações" : "Confirmar Agendamento"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Embedded Client Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        zIndex="z-[60]"
        onSuccess={(newClient) => {
          fetchClients();
          if (newClient?.id) {
            handleClientChange(newClient.id);
          }
        }}
      />
    </>
  );
}
