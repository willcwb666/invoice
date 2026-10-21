"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  User,
  ShieldCheck,
} from "lucide-react";
import { ModalShell } from "@/components/ui/modal-shell";
import { useToast } from "@/components/ui/toast";
import { zonedPartsFromUtc } from "@/lib/calendar/timezone";

interface AgendaInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: any[];
  initialMonthDate?: Date;
  onInvoiceCreated?: (invoice: any) => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function dateKeyDenver(isoOrDate: string | Date): string {
  const p = zonedPartsFromUtc(new Date(isoOrDate));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function formatTimeDenver(isoOrDate: string | Date): string {
  const p = zonedPartsFromUtc(new Date(isoOrDate));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstOfMonth.getDay(); // 0 = Sun
  const startDate = new Date(year, month, 1 - startDayOfWeek);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }
  return days;
}

function isIphoneAutoImportedClient(client: any): boolean {
  if (!client) return false;
  return Boolean(
    typeof client.notes === "string" &&
      client.notes.includes("Importado automaticamente do Calendário iPhone")
  );
}

/**
 * Resolve o cliente de um agendamento (mesmo que tenha vindo do iPhone com apelido)
 * para o Cliente Oficial Cadastrado no Sistema.
 */
function resolveToSystemClientId(appt: any, systemClients: any[]): string | null {
  if (!appt || systemClients.length === 0) return null;

  const directId = appt.clientId || appt.client?.id;
  if (directId && systemClients.some((sc) => sc.id === directId)) {
    return directId;
  }

  const hay = [
    appt.client?.name || "",
    appt.title || "",
    appt.location || "",
    appt.client?.address || "",
  ]
    .join(" ")
    .toLowerCase();

  // Match exato por substring do nome
  const rawName = (appt.client?.name || "").trim().toLowerCase();
  if (rawName) {
    const bySubstring = systemClients.find((sc) => {
      const scName = sc.name.toLowerCase();
      return scName.includes(rawName) || rawName.includes(scName);
    });
    if (bySubstring) return bySubstring.id;
  }

  // Match por tokens (>= 4 letras) do nome do cliente cadastrado no sistema
  const byToken = systemClients.find((sc) => {
    const tokens = String(sc.name || "")
      .toLowerCase()
      .split(/[\s&-]+/)
      .filter((t) => t.length >= 4);
    return tokens.some((tok) => hay.includes(tok));
  });
  if (byToken) return byToken.id;

  return null;
}

export function AgendaInvoiceModal({
  isOpen,
  onClose,
  appointments,
  initialMonthDate,
  onInvoiceCreated,
}: AgendaInvoiceModalProps) {
  const { showToast } = useToast();

  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    const base = initialMonthDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientFilterId, setClientFilterId] = useState<string>("ALL");
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const base = initialMonthDate || new Date();
    setCursorMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setSelectedJobIds([]);
    setSelectedClientId("");
    setClientFilterId("ALL");
    setError(null);

    fetch("/api/v1/clients")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setClients(j.data || []))
      .catch(() => {});
  }, [isOpen, initialMonthDate]);

  // Clientes oficiais cadastrados no sistema (exclui apelidos brutos criados pelo iCloud Sync)
  const systemClients = useMemo(() => {
    const registered = clients.filter((c) => !isIphoneAutoImportedClient(c));
    return (registered.length > 0 ? registered : clients).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [clients]);

  const year = cursorMonth.getFullYear();
  const month = cursorMonth.getMonth();
  const monthGrid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const appt of appointments) {
      if (appt.status === "CANCELLED") continue;
      if (appt.billable === false) continue;
      if (clientFilterId !== "ALL") {
        const directMatch =
          appt.clientId === clientFilterId || appt.client?.id === clientFilterId;
        const resolvedSystemId = resolveToSystemClientId(appt, systemClients);
        if (!directMatch && resolvedSystemId !== clientFilterId) {
          continue;
        }
      }
      const key = dateKeyDenver(appt.startTime || appt.date);
      const list = map.get(key) || [];
      list.push(appt);
      map.set(key, list);
    }
    return map;
  }, [appointments, clientFilterId, systemClients]);

  const selectedAppointments = useMemo(
    () => appointments.filter((a) => selectedJobIds.includes(a.id)),
    [appointments, selectedJobIds]
  );

  const totalAmount = useMemo(
    () => selectedAppointments.reduce((acc, a) => acc + (Number(a.price) || 0), 0),
    [selectedAppointments]
  );

  const toggleAppointment = (appt: any) => {
    // Backend só aceita faturar atendimentos com status COMPLETED (ver
    // InvoiceService.createInvoice) - deixar selecionar um agendamento
    // futuro/ainda não realizado aqui só pra falhar depois no envio.
    if (appt.invoiced || appt.status !== "COMPLETED") return;
    setSelectedJobIds((prev) => {
      const exists = prev.includes(appt.id);
      const next = exists ? prev.filter((id) => id !== appt.id) : [...prev, appt.id];

      // Auto-preenche o cliente da Invoice com o Cliente Cadastrado no Sistema correspondente
      if (!exists && !selectedClientId) {
        const matchedSystemId = resolveToSystemClientId(appt, systemClients);
        if (matchedSystemId) {
          setSelectedClientId(matchedSystemId);
        } else if (systemClients.length === 1) {
          setSelectedClientId(systemClients[0].id);
        }
      }
      return next;
    });
  };

  const selectAllAvailableInMonth = () => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const availableInMonth = appointments.filter((a) => {
      if (a.status !== "COMPLETED" || a.billable === false || a.invoiced) return false;
      if (clientFilterId !== "ALL") {
        const directMatch =
          a.clientId === clientFilterId || a.client?.id === clientFilterId;
        const resolvedSystemId = resolveToSystemClientId(a, systemClients);
        if (!directMatch && resolvedSystemId !== clientFilterId) {
          return false;
        }
      }
      const key = dateKeyDenver(a.startTime || a.date);
      return key.startsWith(monthPrefix);
    });

    if (availableInMonth.length === 0) return;

    const allIds = availableInMonth.map((a) => a.id);
    const allAlreadySelected = allIds.every((id) => selectedJobIds.includes(id));

    if (allAlreadySelected) {
      setSelectedJobIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedJobIds((prev) => Array.from(new Set([...prev, ...allIds])));
      if (!selectedClientId && availableInMonth[0]) {
        const matchedSystemId = resolveToSystemClientId(availableInMonth[0], systemClients);
        if (matchedSystemId) setSelectedClientId(matchedSystemId);
      }
    }
  };

  const handleGenerateInvoice = async () => {
    if (selectedJobIds.length === 0) {
      setError("Selecione pelo menos 1 trabalho no calendário mensal para gerar a Invoice.");
      return;
    }
    if (!selectedClientId) {
      setError("Selecione o Cliente Cadastrado no Sistema que receberá a Invoice.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const invoiceNumber = `INV-${new Date().getFullYear()}-${randomNum}`;

      const res = await fetch("/api/v1/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          invoiceNumber,
          dueDate: new Date(dueDate).toISOString(),
          status: "PENDING",
          notes:
            notes.trim() ||
            `Fatura referente a ${selectedJobIds.length} serviço(s) selecionado(s) na Agenda.`,
          appointmentIds: selectedJobIds,
          items: [],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Falha ao gerar a Invoice.");
      }

      showToast(
        `Invoice ${invoiceNumber} gerada com sucesso para ${
          json.data?.client?.name || "o cliente selecionado"
        } ($${totalAmount.toFixed(2)})!`,
        "success"
      );
      onInvoiceCreated?.(json.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro inesperado ao gerar a Invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={<FileText className="w-5 h-5" />}
      title="Gerar Invoice pela Agenda Mensal"
      subtitle="Navegue entre os meses com as setas, selecione os trabalhos e vincule ao Cliente Oficial Cadastrado no Sistema"
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs"
      panelClassName="w-full max-w-6xl bg-white rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
      iconWrapperClassName="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600"
      closeButtonClassName="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
    >
      <div className="flex-1 overflow-y-auto pt-4 space-y-4 pr-1">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Bar: Month Navigation Arrows + Filter by System Client */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCursorMonth(new Date(year, month - 1, 1))}
              title="Mês Anterior"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="min-w-[180px] text-center px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-sm font-black text-slate-900 tracking-tight">
                {MONTHS_PT[month]} {year}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCursorMonth(new Date(year, month + 1, 1))}
              title="Próximo Mês"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors cursor-pointer shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors cursor-pointer"
            >
              Mês Atual
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={clientFilterId}
                onChange={(e) => {
                  setClientFilterId(e.target.value);
                  if (e.target.value !== "ALL") {
                    setSelectedClientId(e.target.value);
                  }
                }}
                className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="ALL">Filtrar Agenda: Todos os Clientes</option>
                {systemClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={selectAllAvailableInMonth}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Selecionar Disponíveis do Mês</span>
            </button>
          </div>
        </div>

        {/* Monthly Calendar Grid */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="py-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-500"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {monthGrid.map((day, idx) => {
              const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(
                2,
                "0"
              )}-${String(day.getDate()).padStart(2, "0")}`;
              const isCurrentMonth = day.getMonth() === month;
              const dayJobs = byDate.get(key) || [];

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] p-1.5 flex flex-col gap-1 transition-colors ${
                    isCurrentMonth ? "bg-white" : "bg-slate-50/50 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between px-1">
                    <span
                      className={`text-[11px] font-bold ${
                        isCurrentMonth ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayJobs.length > 0 && (
                      <span className="text-[9px] font-bold text-slate-400">
                        {dayJobs.length} job{dayJobs.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 flex-1">
                    {dayJobs.map((job) => {
                      const isSelected = selectedJobIds.includes(job.id);
                      const isAlreadyInvoiced = Boolean(job.invoiced);
                      // Só atendimento com status COMPLETED pode ser faturado
                      // (mesma regra do backend) - um agendamento futuro/ainda
                      // não realizado não é "faturável" só por não ter sido
                      // faturado ainda.
                      const isNotCompletedYet = !isAlreadyInvoiced && job.status !== "COMPLETED";
                      const isDisabled = isAlreadyInvoiced || isNotCompletedYet;
                      const priceNum = Number(job.price) || 0;

                      return (
                        <button
                          key={job.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => toggleAppointment(job)}
                          title={isNotCompletedYet ? "Ainda não realizado - não pode ser faturado" : undefined}
                          className={`w-full text-left p-1.5 rounded-lg border text-[10px] transition-all flex items-start gap-1.5 ${
                            isDisabled
                              ? "bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                              : isSelected
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30 cursor-pointer"
                              : "bg-slate-50 hover:bg-indigo-50/70 border-slate-200 hover:border-indigo-300 text-slate-800 cursor-pointer"
                          }`}
                        >
                          <div
                            className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                              isDisabled
                                ? "border-slate-300 bg-slate-200"
                                : isSelected
                                ? "border-white bg-white text-emerald-700"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold truncate">
                                {job.client?.name || job.title}
                              </span>
                              <span
                                className={`font-black shrink-0 ${
                                  isSelected
                                    ? "text-white"
                                    : isDisabled
                                    ? "text-slate-400"
                                    : "text-emerald-600"
                                }`}
                              >
                                ${priceNum.toFixed(0)}
                              </span>
                            </div>
                            <div
                              className={`text-[9px] truncate ${
                                isSelected ? "text-emerald-100" : "text-slate-400"
                              }`}
                            >
                              {formatTimeDenver(job.startTime)} ·{" "}
                              {isAlreadyInvoiced
                                ? "Já Faturado"
                                : isNotCompletedYet
                                ? "Ainda não realizado"
                                : job.title}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Summary & Invoice Generation Controls */}
      <div className="pt-4 mt-3 border-t border-slate-200 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1 mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Cliente Cadastrado no Sistema (Invoice) *</span>
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Selecione o cliente oficial do sistema...</option>
              {systemClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `— ${c.city}, ${c.state || "CO"}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Vencimento da Fatura
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Observação na Invoice (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Referente às limpezas do mês..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0">
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {selectedJobIds.length} trabalho(s) selecionado(s)
            </span>
            <span className="text-lg font-black text-emerald-600">
              Total: ${totalAmount.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleGenerateInvoice}
            disabled={submitting || selectedJobIds.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gerando Invoice...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Gerar Invoice (${totalAmount.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
