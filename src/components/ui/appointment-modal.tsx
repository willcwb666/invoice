"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  UserPlus,
  AlertCircle,
  Loader2,
  Check,
  Wrench,
  Users,
  X,
  ChevronDown,
  Sparkles,
  Repeat,
  Trash2,
  HelpCircle,
  Search,
} from "lucide-react";
import { ClientModal } from "@/components/ui/client-modal";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";
import { zonedTimeToUtc, zonedPartsFromUtc } from "@/lib/calendar/timezone";
import {
  addToOfflineSyncQueue,
  saveCachedClients,
  getCachedClients,
} from "@/lib/offline/offline-agenda";
import {
  RECURRENCE_OPTIONS,
  RecurrenceFrequency,
  AppointmentUpdateScope,
  AppointmentDeleteScope,
  getRecurrenceLabel,
  getRecurrenceSummary,
} from "@/lib/scheduling/recurrence";
import type { CleaningCommissionCategory, ProfessionalRecord } from "@/services/professional-service";

/** "HH:MM" de um horário armazenado (UTC) no fuso de Denver, para os campos de horário. */
function toDenverTimeInput(isoOrDate: string | Date): string {
  const p = zonedPartsFromUtc(new Date(isoOrDate));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" de um horário armazenado (UTC) no fuso de Denver, para o campo de data. */
function toDenverDateInput(isoOrDate: string | Date): string {
  const p = zonedPartsFromUtc(new Date(isoOrDate));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** When provided, the modal edits this existing appointment instead of creating a new one. */
  appointment?: any | null;
  /** Pre-selected YYYY-MM-DD date when clicking a blank space inside a day cell on the Agenda. */
  initialDate?: string | null;
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

const CLEANING_CATEGORY_OPTIONS: { value: CleaningCommissionCategory; label: string }[] = [
  { value: "STANDARD", label: "Standard Cleaning (Regular)" },
  { value: "DEEP", label: "Deep Cleaning (Pesada)" },
  { value: "MOVE_IN_OUT", label: "Move-In / Move-Out" },
  { value: "CUSTOM", label: "Limpeza Parcial / Outros" },
];

export function AppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  appointment,
  initialDate,
}: AppointmentModalProps) {
  const { showToast } = useToast();
  const isEditing = Boolean(appointment);

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const clientSearchContainerRef = useRef<HTMLDivElement>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalRecord[]>([]);
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>([
    "prof-willians",
    "prof-renata",
  ]);
  const [cleaningCategory, setCleaningCategory] = useState<CleaningCommissionCategory>("STANDARD");
  const [isProfListboxOpen, setIsProfListboxOpen] = useState(false);
  const profDropdownRef = useRef<HTMLDivElement>(null);

  const [autoTitle, setAutoTitle] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => toDenverDateInput(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("SCHEDULED");
  const [billable, setBillable] = useState(true);

  // Recorrência
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceFrequency>("NONE");
  const [recurrenceDurationMonths, setRecurrenceDurationMonths] = useState<number>(12);

  // Escopo de alteração / exclusão para séries recorrentes
  const [isScopeConfirmOpen, setIsScopeConfirmOpen] = useState(false);
  const [scopeAction, setScopeAction] = useState<"UPDATE" | "DELETE">("UPDATE");
  const [selectedScope, setSelectedScope] = useState<AppointmentUpdateScope>("THIS_AND_FOLLOWING");

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/v1/clients");
      if (res.ok) {
        const json = await res.json();
        const clientList = json.data || [];
        setClients(clientList);
        saveCachedClients(clientList);
      } else {
        const cached = getCachedClients();
        if (cached.length > 0) setClients(cached);
      }
    } catch {
      const cached = getCachedClients();
      if (cached.length > 0) setClients(cached);
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

  const fetchProfessionals = async () => {
    try {
      const res = await fetch("/api/v1/professionals");
      if (res.ok) {
        const json = await res.json();
        setProfessionals(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar profissionais:", e);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const res = await fetch("/api/v1/company");
      if (res.ok) {
        const json = await res.json();
        if (json.data?.recurrenceHorizonMonths) {
          setRecurrenceDurationMonths(Number(json.data.recurrenceHorizonMonths));
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profDropdownRef.current && !profDropdownRef.current.contains(event.target as Node)) {
        setIsProfListboxOpen(false);
      }
      if (
        clientSearchContainerRef.current &&
        !clientSearchContainerRef.current.contains(event.target as Node)
      ) {
        setIsClientSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchClients();
    fetchServices();
    fetchProfessionals();
    setError(null);
    setIsProfListboxOpen(false);
    setIsScopeConfirmOpen(false);
    setIsClientSearchOpen(false);
    setClientSearchQuery("");

    if (appointment) {
      setSelectedClientId(appointment.clientId || appointment.client?.id || "");
      const apptServiceIds: string[] = (appointment.services || [])
        .map((as: any) => as.service?.id || as.serviceId)
        .filter(Boolean);
      setSelectedServiceIds(apptServiceIds);
      setSelectedProfessionalIds(
        Array.isArray(appointment.professionalIds) && appointment.professionalIds.length > 0
          ? appointment.professionalIds
          : ["prof-willians", "prof-renata"]
      );
      setCleaningCategory(
        (appointment.cleaningCategory as CleaningCommissionCategory) || "STANDARD"
      );
      setAutoTitle("");
      setTitle(appointment.title || "");
      setDate(toDenverDateInput(appointment.startTime));
      setStartTime(toDenverTimeInput(appointment.startTime));
      setEndTime(toDenverTimeInput(appointment.endTime));
      setLocation(appointment.location || "");
      setPrice(Number(appointment.price) || 0);
      setNotes(appointment.notes || "");
      setStatus((appointment.status as AppointmentStatus) || "SCHEDULED");
      setBillable(appointment.billable !== false);
      setRecurrenceRule((appointment.recurrenceRule as RecurrenceFrequency) || "NONE");
      setRecurrenceDurationMonths(12);
      setSelectedScope("THIS_AND_FOLLOWING");
    } else {
      setSelectedClientId("");
      setSelectedServiceIds([]);
      setSelectedProfessionalIds(["prof-willians", "prof-renata"]);
      setCleaningCategory("STANDARD");
      setAutoTitle("");
      setTitle("");
      setDate(initialDate || toDenverDateInput(new Date()));
      setStartTime("09:00");
      setEndTime("12:00");
      setLocation("");
      setPrice(0);
      setNotes("");
      setStatus("SCHEDULED");
      setBillable(true);
      setRecurrenceRule("NONE");
      setRecurrenceDurationMonths(2);
      setSelectedScope("THIS_AND_FOLLOWING");
      fetchCompanySettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, appointment, initialDate]);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return (
      clients.find((c) => c.id === selectedClientId) ||
      (appointment?.clientId === selectedClientId ? appointment.client : null)
    );
  }, [clients, selectedClientId, appointment]);

  const filteredClients = useMemo(() => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const addr = (c.address || "").toLowerCase();
      const city = (c.city || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return name.includes(q) || addr.includes(q) || city.includes(q) || phone.includes(q);
    });
  }, [clients, clientSearchQuery]);

  const handleSelectClient = (client: any) => {
    if (!client) return;
    setSelectedClientId(client.id);
    setClientSearchQuery("");
    setIsClientSearchOpen(false);
    setError(null);
    if (client.address) {
      const fullAddr = `${client.address}${client.city ? ` - ${client.city}` : ""}${
        client.state ? `, ${client.state}` : ""
      }${client.zipCode ? ` ${client.zipCode}` : ""}`;
      setLocation(fullAddr);
    }
  };

  const toggleProfessional = (profId: string) => {
    setSelectedProfessionalIds((prev) =>
      prev.includes(profId) ? prev.filter((id) => id !== profId) : [...prev, profId]
    );
  };

  const removeProfessionalChip = (profId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProfessionalIds((prev) => prev.filter((id) => id !== profId));
  };

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

      const lower = generatedTitle.toLowerCase();
      if (lower.includes("move")) setCleaningCategory("MOVE_IN_OUT");
      else if (lower.includes("deep") || lower.includes("pesad")) setCleaningCategory("DEEP");
      else if (lower.includes("standard") || lower.includes("regular")) setCleaningCategory("STANDARD");

      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError("Por favor, selecione ou cadastre um cliente.");
      return;
    }

    // Se estiver editando e for parte de uma série recorrente, abre o diálogo de escopo
    if (isEditing && appointment?.seriesId) {
      setScopeAction("UPDATE");
      setIsScopeConfirmOpen(true);
      return;
    }

    await executeSave("THIS_ONLY");
  };

  const executeSave = async (scopeToApply: AppointmentUpdateScope) => {
    setLoading(true);
    setError(null);
    setIsScopeConfirmOpen(false);

    try {
      const [year, month, day] = date.split("-").map(Number);
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);

      const startDateTime = zonedTimeToUtc(year, month - 1, day, startHour, startMinute, 0).toISOString();
      const endDateTime = zonedTimeToUtc(year, month - 1, day, endHour, endMinute, 0).toISOString();
      const dateOnly = zonedTimeToUtc(year, month - 1, day, 0, 0, 0).toISOString();

      const payload: Record<string, unknown> = {
        clientId: selectedClientId,
        serviceIds: selectedServiceIds,
        professionalIds: selectedProfessionalIds,
        cleaningCategory,
        title,
        date: dateOnly,
        startTime: startDateTime,
        endTime: endDateTime,
        location: location || null,
        price: Number(price),
        notes: notes || null,
        billable,
        recurrenceRule,
        recurrenceDurationMonths,
      };

      payload.status = status;
      if (isEditing) {
        payload.updateScope = scopeToApply;
      } else {
        payload.origin = "INTERNAL";
      }

      // Verificação de modo offline antes do envio
      const isCurrentlyOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

      if (!isCurrentlyOnline) {
        addToOfflineSyncQueue(
          isEditing ? "UPDATE" : "CREATE",
          payload,
          isEditing ? appointment?.id : undefined
        );
        showToast(
          isEditing
            ? "Agendamento atualizado localmente (Modo Offline). Será sincronizado automaticamente assim que a conexão retornar."
            : "Agendamento salvo localmente (Modo Offline). Será sincronizado automaticamente assim que a conexão retornar.",
          "warning",
          6000
        );
        onSuccess?.();
        onClose();
        return;
      }

      try {
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

        const successMsg = isEditing
          ? scopeToApply === "THIS_AND_FOLLOWING"
            ? "Este e todos os atendimentos futuros da série foram atualizados com sucesso!"
            : "Agendamento atualizado com sucesso."
          : recurrenceRule !== "NONE"
          ? `Série recorrente (${getRecurrenceLabel(recurrenceRule)}) criada com sucesso para os próximos ${recurrenceDurationMonths} meses!`
          : "Agendamento criado com sucesso.";

        showToast(successMsg, "success");

        // Se o atendimento acabou de ser marcado como COMPLETED, envia localização para calcular próximo cliente
        if (isEditing && payload.status === "COMPLETED") {
          if (typeof navigator !== "undefined" && "geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                fetch("/api/v1/push/location", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    lastAppointmentId: appointment?.id,
                  }),
                }).catch(() => {});
              },
              () => {
                fetch("/api/v1/push/location", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    lastAppointmentId: appointment?.id,
                  }),
                }).catch(() => {});
              },
              { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
            );
          }
        }

        onSuccess?.();
        onClose();
      } catch (networkErr: any) {
        if (
          networkErr?.message?.includes("fetch") ||
          networkErr?.name === "TypeError" ||
          (typeof navigator !== "undefined" && !navigator.onLine)
        ) {
          addToOfflineSyncQueue(
            isEditing ? "UPDATE" : "CREATE",
            payload,
            isEditing ? appointment?.id : undefined
          );
          showToast(
            "Conexão instável. Agendamento salvo localmente e na fila para sincronização automática.",
            "warning",
            6000
          );
          onSuccess?.();
          onClose();
          return;
        }
        throw networkErr;
      }
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao salvar o agendamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    if (!appointment) return;
    if (appointment.seriesId) {
      setScopeAction("DELETE");
      setIsScopeConfirmOpen(true);
    } else {
      if (confirm("Tem certeza que deseja excluir este agendamento?")) {
        executeDelete("THIS_ONLY");
      }
    }
  };

  const executeDelete = async (scope: AppointmentDeleteScope) => {
    if (!appointment) return;
    setDeleting(true);
    setIsScopeConfirmOpen(false);

    try {
      const res = await fetch(`/api/v1/appointments/${appointment.id}?deleteScope=${scope}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Falha ao excluir agendamento.");
      }

      showToast(
        scope === "THIS_AND_FOLLOWING"
          ? "Este e os próximos agendamentos da série foram excluídos com sucesso."
          : "Agendamento excluído com sucesso.",
        "success"
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao excluir agendamento.");
      showToast(err.message || "Erro ao excluir agendamento.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        icon={<Calendar className="w-5 h-5" />}
        title={isEditing ? "Editar Agendamento" : "Novo Agendamento na Agenda"}
        subtitle={
          isEditing
            ? "Ajuste serviços, valores, horário, profissionais ou recorrência"
            : "Cadastre novos atendimentos avulsos ou séries recorrentes com repetição automática"
        }
        backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        panelClassName="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
        iconWrapperClassName="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600"
        closeButtonClassName="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        {/* Form Content */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto pt-4 space-y-4 pr-1 text-xs"
        >
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Banner de Série Recorrente ao Editar */}
          {isEditing && appointment?.seriesId && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/90 text-indigo-950 flex items-start gap-2.5 shadow-2xs">
              <Repeat className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs">Agendamento em Série Recorrente</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-200/70 text-indigo-900 font-black text-[10px] uppercase">
                    {getRecurrenceLabel(appointment.recurrenceRule)}
                  </span>
                </div>
                <p className="text-[11px] text-indigo-800/90 mt-0.5 leading-relaxed">
                  Ao salvar alterações de data, horário ou frequência, você poderá escolher entre
                  atualizar <strong>apenas esta data</strong> ou <strong>este e todos os futuros</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Cliente Selector via Campo de Busca por Texto (Nome ou Endereço) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700 block text-xs">
                Cliente Atendido *
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsClientSearchOpen(false);
                  setIsClientModalOpen(true);
                }}
                className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer text-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Cadastrar Novo Cliente</span>
              </button>
            </div>

            {selectedClient ? (
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/90 flex items-center justify-between gap-3 shadow-2xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs truncate">
                      {selectedClient.name}
                    </span>
                    {selectedClient.phone && (
                      <span className="text-slate-500 text-[11px] font-mono">
                        · {selectedClient.phone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                    <span className="truncate">
                      {selectedClient.address || "Endereço não cadastrado"}
                      {selectedClient.city ? ` - ${selectedClient.city}` : ""}
                      {selectedClient.state ? `, ${selectedClient.state}` : ""}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientId("");
                    setClientSearchQuery("");
                    setIsClientSearchOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-indigo-600 border border-slate-200 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
                >
                  Trocar Cliente
                </button>
              </div>
            ) : (
              <div className="relative" ref={clientSearchContainerRef}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Digite o nome da pessoa ou endereço do cliente..."
                    value={clientSearchQuery}
                    onChange={(e) => {
                      setClientSearchQuery(e.target.value);
                      setIsClientSearchOpen(true);
                    }}
                    onFocus={() => setIsClientSearchOpen(true)}
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs text-xs"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  {clientSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setClientSearchQuery("")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isClientSearchOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {filteredClients.length > 0 ? (
                      <>
                        <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span>Clientes Encontrados ({filteredClients.length})</span>
                          <span>Busca por Nome ou Endereço</span>
                        </div>
                        {filteredClients.map((c: any) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectClient(c)}
                            className="p-2.5 hover:bg-indigo-50/70 cursor-pointer transition-colors group flex items-start justify-between gap-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 group-hover:text-indigo-900 text-xs flex items-center gap-2">
                                <span>{c.name}</span>
                                {c.phone && (
                                  <span className="text-[10px] font-mono text-slate-400 font-normal">
                                    · {c.phone}
                                  </span>
                                )}
                              </div>
                              {c.address && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-500 group-hover:text-indigo-700/80 mt-0.5 truncate">
                                  <MapPin className="w-3 h-3 shrink-0 text-slate-400 group-hover:text-indigo-500" />
                                  <span className="truncate">
                                    {c.address}
                                    {c.city ? ` - ${c.city}` : ""}
                                  </span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                              Selecionar
                            </span>
                          </div>
                        ))}
                        <div
                          onClick={() => {
                            setIsClientSearchOpen(false);
                            setIsClientModalOpen(true);
                          }}
                          className="p-2.5 bg-slate-50 hover:bg-indigo-50 cursor-pointer flex items-center gap-2 text-indigo-600 font-bold text-xs transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {clientSearchQuery.trim()
                              ? `+ Cadastrar "${clientSearchQuery.trim()}" como Novo Cliente`
                              : "+ Cadastrar Novo Cliente"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="p-4 text-center space-y-2.5">
                        <p className="text-xs text-slate-500">
                          Nenhum cliente cadastrado com{" "}
                          <strong className="text-slate-800">
                            &ldquo;{clientSearchQuery}&rdquo;
                          </strong>{" "}
                          em nome ou endereço.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsClientSearchOpen(false);
                            setIsClientModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>
                            {clientSearchQuery.trim()
                              ? `+ Cadastrar "${clientSearchQuery.trim()}"`
                              : "+ Adicionar Cliente"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profissionais Escalados & Tipo de Limpeza */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7 relative" ref={profDropdownRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Profissionais Escalados</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {selectedProfessionalIds.length} selecionado(s)
                </span>
              </div>

              <div
                onClick={() => setIsProfListboxOpen(!isProfListboxOpen)}
                className="min-h-[42px] px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 focus-within:border-indigo-500 focus-within:bg-white flex flex-wrap items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                {selectedProfessionalIds.length === 0 ? (
                  <span className="text-slate-400 px-1 py-1">
                    Clique para selecionar os profissionais...
                  </span>
                ) : (
                  selectedProfessionalIds.map((pId) => {
                    const prof = professionals.find((p) => p.id === pId);
                    const name = prof ? prof.name : pId.replace("prof-", "");
                    return (
                      <span
                        key={pId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100/90 text-indigo-900 border border-indigo-200/80 font-bold text-[11px] shadow-2xs"
                      >
                        <span>{name}</span>
                        <span
                          role="button"
                          onClick={(e) => removeProfessionalChip(pId, e)}
                          title={`Remover ${name}`}
                          className="hover:bg-indigo-200/80 rounded p-0.5 cursor-pointer transition-colors"
                        >
                          <X className="w-3 h-3 text-indigo-700" />
                        </span>
                      </span>
                    );
                  })
                )}
                <ChevronDown className="w-4 h-4 text-slate-400 ml-auto mr-1" />
              </div>

              {isProfListboxOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 max-h-56 overflow-y-auto space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Selecione quem executará o serviço
                  </div>
                  {professionals.length === 0 ? (
                    <div className="p-3 text-center text-slate-400">Nenhum profissional carregado</div>
                  ) : (
                    professionals.map((prof) => {
                      const selected = selectedProfessionalIds.includes(prof.id);
                      return (
                        <div
                          key={prof.id}
                          onClick={() => toggleProfessional(prof.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                            selected
                              ? "bg-indigo-50 text-indigo-950 font-bold border border-indigo-100"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                prof.color === "indigo"
                                  ? "bg-indigo-500"
                                  : prof.color === "emerald"
                                  ? "bg-emerald-500"
                                  : prof.color === "amber"
                                  ? "bg-amber-500"
                                  : "bg-slate-400"
                              }`}
                            />
                            <span>{prof.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({prof.roleTitle || prof.role})
                            </span>
                          </div>
                          {selected && <Check className="w-4 h-4 text-indigo-600" />}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="sm:col-span-5">
              <label className="font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Categoria de Comissão</span>
              </label>
              <select
                value={cleaningCategory}
                onChange={(e) => setCleaningCategory(e.target.value as CleaningCommissionCategory)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                {CLEANING_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Serviços do Catálogo */}
          <div>
            <label className="font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                <span>Serviços / Itens Contratados</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Selecione um ou mais para compor o valor e título
              </span>
            </label>

            {services.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-400">
                Carregando catálogo de serviços...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/50">
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
              Título do Atendimento na Agenda
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
                Data do Atendimento
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

          {/* SEÇÃO DE RECORRÊNCIA */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-indigo-600" />
                <span>Frequência / Recorrência do Cliente</span>
              </label>
              <span className="text-[11px] font-semibold text-indigo-700">
                {getRecurrenceLabel(recurrenceRule)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {RECURRENCE_OPTIONS.map((opt) => {
                const isSelected = recurrenceRule === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRecurrenceRule(opt.value)}
                    className={`px-2.5 py-2 rounded-xl border text-center transition-all cursor-pointer font-bold text-[11px] ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt.value === "NONE"
                      ? "Único"
                      : opt.value === "WEEKLY"
                      ? "Semanal"
                      : opt.value === "BIWEEKLY"
                      ? "Bi-semanal"
                      : opt.value === "EVERY_3_WEEKS"
                      ? "A cada 3 sem"
                      : "Mensal"}
                  </button>
                );
              })}
            </div>

            {recurrenceRule !== "NONE" && (
              <div className="pt-2 border-t border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[11px] text-indigo-900 font-medium leading-relaxed">
                  {getRecurrenceSummary(recurrenceRule, date, startTime, recurrenceDurationMonths)}
                </p>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Período:</span>
                  <select
                    value={recurrenceDurationMonths}
                    onChange={(e) => setRecurrenceDurationMonths(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-950 text-[11px] font-bold focus:outline-none cursor-pointer"
                  >
                    <option value={3}>3 meses</option>
                    <option value={6}>6 meses</option>
                    <option value={12}>1 ano (12 meses)</option>
                    <option value={24}>2 anos (24 meses)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Price & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Valor Cobrado ($ USD) *
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

          {/* Flag de Conclusão do Atendimento */}
          <div
            onClick={() => setStatus((prev) => (prev === "COMPLETED" ? "SCHEDULED" : "COMPLETED"))}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              status === "COMPLETED"
                ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-500/20"
                : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  status === "COMPLETED"
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-400"
                }`}
              >
                <Check className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-xs">Atendimento Concluído</p>
                <p className="text-[11px] text-slate-500">
                  {status === "COMPLETED"
                    ? "Serviço finalizado na residência (pronto para cobrança)"
                    : "Serviço agendado para execução"}
                </p>
              </div>
            </div>

            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                status === "COMPLETED"
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              {status === "COMPLETED" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>

          {/* Status Detalhado (ao editar) */}
          {isEditing && (
            <div>
              <label className="font-bold text-slate-700 block mb-1.5 text-xs">Status do Agendamento</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer text-xs"
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

          {/* Não Faturável */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={!billable}
              onChange={(e) => setBillable(!e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              <span className="font-semibold text-slate-900 block">Não Faturável</span>
              <span className="text-slate-500">
                Marque para eventos que não devem contar no financeiro (compromisso
                pessoal, cortesia, etc).
              </span>
            </span>
          </label>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2.5">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={loading || deleting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  title="Excluir agendamento"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || deleting}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading || deleting}
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
          </div>
        </form>
      </ModalShell>

      {/* Modal de Confirmação de Escopo para Série Recorrente */}
      {isScopeConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-xs">
            <div className="flex items-start gap-3">
              <div
                className={`p-3 rounded-2xl border shrink-0 ${
                  scopeAction === "DELETE"
                    ? "bg-rose-50 text-rose-600 border-rose-100"
                    : "bg-indigo-50 text-indigo-600 border-indigo-100"
                }`}
              >
                {scopeAction === "DELETE" ? (
                  <Trash2 className="w-6 h-6" />
                ) : (
                  <Repeat className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {scopeAction === "DELETE"
                    ? "Excluir Agendamento Recorrente"
                    : "Aplicar Alterações na Série Recorrente"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {scopeAction === "DELETE"
                    ? "Este atendimento faz parte de uma série. Escolha como deseja excluir:"
                    : "Este atendimento faz parte de uma série. Escolha o escopo de atualização:"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {/* Opção 1: Este e todos os futuros */}
              <label
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedScope === "THIS_AND_FOLLOWING"
                    ? "bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="recurrenceScope"
                  value="THIS_AND_FOLLOWING"
                  checked={selectedScope === "THIS_AND_FOLLOWING"}
                  onChange={() => setSelectedScope("THIS_AND_FOLLOWING")}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold block text-slate-900">
                    {scopeAction === "DELETE"
                      ? "Excluir este e todos os atendimentos futuros"
                      : "Este e todos os atendimentos futuros (Recomendado)"}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                    {scopeAction === "DELETE"
                      ? "Mantém o histórico passado intacto e cancela este e todos os agendamentos futuros da série."
                      : "Mantém intactos todos os atendimentos passados no histórico e reprograma esta e todas as próximas semanas (novo dia, horário ou frequência)."}
                  </span>
                </div>
              </label>

              {/* Opção 2: Apenas este */}
              <label
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedScope === "THIS_ONLY"
                    ? "bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="recurrenceScope"
                  value="THIS_ONLY"
                  checked={selectedScope === "THIS_ONLY"}
                  onChange={() => setSelectedScope("THIS_ONLY")}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold block text-slate-900">
                    {scopeAction === "DELETE"
                      ? "Excluir apenas este atendimento"
                      : "Apenas este agendamento pontualmente"}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                    {scopeAction === "DELETE"
                      ? "Exclui apenas o agendamento desta data específica, mantendo as demais semanas normais."
                      : "Remarcação pontual apenas desta data específica, sem alterar as demais semanas da série."}
                  </span>
                </div>
              </label>

              {/* Opção 3: Toda a série */}
              <label
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedScope === "ALL_SERIES"
                    ? "bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="recurrenceScope"
                  value="ALL_SERIES"
                  checked={selectedScope === "ALL_SERIES"}
                  onChange={() => setSelectedScope("ALL_SERIES")}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold block text-slate-900">
                    {scopeAction === "DELETE"
                      ? "Excluir toda a série"
                      : "Todos os agendamentos da série"}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                    {scopeAction === "DELETE"
                      ? "Exclui todos os atendimentos da série que ainda não foram faturados."
                      : "Aplica as alterações a todos os atendimentos da série que ainda não foram faturados."}
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsScopeConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => {
                  if (scopeAction === "DELETE") {
                    executeDelete(selectedScope as AppointmentDeleteScope);
                  } else {
                    executeSave(selectedScope);
                  }
                }}
                disabled={loading || deleting}
                className={`px-5 py-2.5 rounded-xl text-white font-bold shadow-md transition-all cursor-pointer ${
                  scopeAction === "DELETE"
                    ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                    : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                }`}
              >
                {loading || deleting
                  ? "Processando..."
                  : scopeAction === "DELETE"
                  ? "Confirmar Exclusão"
                  : "Confirmar e Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Client Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        zIndex="z-[60]"
        initialQuery={clientSearchQuery}
        onSuccess={(newClient) => {
          fetchClients();
          if (newClient?.id) {
            handleSelectClient(newClient);
          }
        }}
      />
    </>
  );
}
