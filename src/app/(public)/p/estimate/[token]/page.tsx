"use client";

import React, { useState, useEffect, use } from "react";
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Phone,
  MessageSquare,
  AlertCircle,
  Loader2,
  Check,
  ChevronRight,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PublicEstimateBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Seleção de agendamento
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [clientNotes, setClientNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookedSuccess, setBookedSuccess] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/public/estimates/${token}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Não foi possível carregar o orçamento.");
        }
        setData(json.data);

        // Pré-seleciona o primeiro dia disponível com vagas
        const firstAvailable = json.data.availableDays?.find((d: any) => d.isAvailable);
        if (firstAvailable) {
          setSelectedDate(firstAvailable.date);
          if (firstAvailable.slots?.length > 0) {
            setSelectedSlot(firstAvailable.slots[0].time);
          }
        }
      } catch (err: any) {
        setError(err.message || "Erro ao consultar orçamento.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedSlot) {
      setError("Por favor, selecione uma data e horário disponíveis.");
      return;
    }

    setBooking(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/public/estimates/${token}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          time: selectedSlot,
          clientNotes: clientNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao confirmar agendamento.");
      }

      setBookedSuccess(json.data);
    } catch (err: any) {
      setError(err.message || "Falha ao confirmar agendamento.");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-500">
            Calculando rotas e horários disponíveis...
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Orçamento Indisponível</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  const { estimate, company, durationMinutes, availableDays } = data;
  const originalSubtotal = estimate.subtotal || estimate.totalAmount;
  const hasDiscount = estimate.discount > 0 || estimate.abandonedDiscountApplied;
  const currentDayConfig = availableDays?.find((d: any) => d.date === selectedDate);

  // Link rápido para SMS/WhatsApp
  const cleanPhone = (company.phone || "9704129406").replace(/\D/g, "");
  const smsMessage = encodeURIComponent(
    `Hi Renata! I received the $${estimate.totalAmount.toFixed(
      2
    )} quote for ${estimate.client.name}. I would like to schedule for ${
      selectedDate || "soon"
    } at ${selectedSlot || "morning"}. Address: ${estimate.client.address || ""}`
  );
  const smsLink = `sms:+1${cleanPhone}?&body=${smsMessage}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-slate-50 to-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header da Empresa */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-200 rounded-full text-amber-800 text-[11px] font-bold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{company.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Proposta de Limpeza & Agendamento
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Horários sincronizados em tempo real com garantia de deslocamento
          </p>
        </div>

        {/* Banner de Sucesso pós-agendamento */}
        {bookedSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 border border-emerald-200 shadow-xl text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-sm">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                Agendamento Confirmado!
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">
                Obrigado, {estimate.client.name}!
              </h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Seu atendimento foi agendado com sucesso em nossa agenda. Já reservamos sua equipe e todos os equipamentos necessários.
              </p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 max-w-md mx-auto text-xs space-y-2 text-left">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Data Selecionada:</span>
                <span className="font-bold text-slate-900">{bookedSuccess.date}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Horário Previsto:</span>
                <span className="font-bold text-emerald-700 font-mono text-sm">{bookedSuccess.time}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Valor do Atendimento:</span>
                <span className="font-black text-slate-900 font-mono text-sm">
                  ${estimate.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={smsLink}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Enviar Confirmação por SMS</span>
              </a>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Banner de Desconto de Incentivo */}
            {hasDiscount && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">
                      Desconto Especial de Incentivo Aplicado! 🎉
                    </h4>
                    <p className="text-[11px] text-white/90">
                      Garanta sua vaga hoje para usufruir da tarifa promocional exclusiva.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold bg-white text-emerald-800 px-2.5 py-1 rounded-lg shadow-2xs font-mono">
                    -${estimate.discount.toFixed(2)} OFF
                  </span>
                </div>
              </motion.div>
            )}

            {/* Card com Resumo do Orçamento */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/80">
                    Orçamento #{estimate.estimateNumber}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-2">
                    {estimate.client.name}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{estimate.client.address || "Endereço residencial"}</span>
                  </p>
                </div>

                <div className="sm:text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Valor Total do Serviço
                  </span>
                  <div className="flex items-baseline sm:justify-end gap-2 mt-0.5">
                    {hasDiscount && (
                      <span className="text-xs text-slate-400 line-through font-mono">
                        ${originalSubtotal.toFixed(2)}
                      </span>
                    )}
                    <span className="text-2xl font-black font-mono text-emerald-700">
                      ${estimate.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center sm:justify-end gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Duração prevista: ~{Math.round(durationMinutes / 60 * 10) / 10}h ({durationMinutes} min)</span>
                  </span>
                </div>
              </div>

              {/* Itens discriminados */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Serviços Inclusos:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {estimate.items.map((it: any) => (
                    <div
                      key={it.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                    >
                      <span className="text-slate-800 font-medium truncate pr-2">
                        {it.description}
                      </span>
                      <span className="font-mono font-bold text-slate-900 shrink-0">
                        ${it.unitPrice.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SELETOR DINÂMICO DE VAGAS COM OTIMIZAÇÃO DE ROTA */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xl space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>Escolha o Melhor Dia e Horário</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nossos horários são calculados automaticamente considerando o trânsito e a rota para atender você com pontualidade.
                </p>
              </div>

              {/* Seletor de Dias (Scroll horizontal ou grid) */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  1. Selecione a Data:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {availableDays?.map((d: any) => {
                    const isSelected = selectedDate === d.date;
                    const [y, m, dayNum] = d.date.split("-");
                    const dateObj = new Date(Number(y), Number(m) - 1, Number(dayNum));
                    const monthName = dateObj.toLocaleDateString("pt-BR", { month: "short" });

                    return (
                      <button
                        key={d.date}
                        type="button"
                        disabled={!d.isAvailable}
                        onClick={() => {
                          setSelectedDate(d.date);
                          if (d.slots?.length > 0) {
                            setSelectedSlot(d.slots[0].time);
                          } else {
                            setSelectedSlot(null);
                          }
                        }}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col justify-between ${
                          !d.isAvailable
                            ? "bg-slate-50/60 border-slate-200/60 opacity-50 cursor-not-allowed"
                            : isSelected
                            ? "bg-amber-500 border-amber-600 text-white shadow-md ring-2 ring-amber-300"
                            : "bg-white border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 text-slate-800"
                        }`}
                      >
                        <div>
                          <span
                            className={`text-[10px] font-bold uppercase block ${
                              isSelected ? "text-amber-100" : "text-slate-400"
                            }`}
                          >
                            {d.dayOfWeekLabel.slice(0, 3)}
                          </span>
                          <span
                            className={`text-base font-black font-mono block my-0.5 ${
                              isSelected ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {dayNum} {monthName}
                          </span>
                        </div>

                        <span
                          className={`text-[9px] font-bold py-0.5 px-1.5 rounded-full mt-1 ${
                            !d.isAvailable
                              ? "bg-slate-200/80 text-slate-500"
                              : isSelected
                              ? "bg-white text-amber-800"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {d.isAvailable ? `${d.slots.length} vaga(s)` : "Sem vaga"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seletor de Horários do Dia Selecionado */}
              {currentDayConfig && currentDayConfig.isAvailable && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    2. Selecione o Horário de Início:
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {currentDayConfig.slots.map((s: any) => {
                      const isSelected = selectedSlot === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          onClick={() => setSelectedSlot(s.time)}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 border-emerald-600 text-white font-black shadow-md ring-2 ring-emerald-200"
                              : "bg-white border-slate-200 hover:border-emerald-500 text-slate-800 font-bold"
                          }`}
                        >
                          <span className="text-sm font-mono block">{s.time}</span>
                          {s.fitNote && (
                            <span
                              className={`text-[9px] font-medium block mt-0.5 truncate ${
                                isSelected ? "text-emerald-100" : "text-slate-400"
                              }`}
                            >
                              {s.fitNote}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observações opcionais */}
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Instruções ou preferências de acesso (opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Chave na portaria, temos 1 gato, portão lateral destrancado..."
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Botões de Ação Final */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <a
                  href={smsLink}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Dúvidas? Falar por SMS/WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={booking || !selectedDate || !selectedSlot}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  {booking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirmando sua Vaga...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirmar Agendamento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Rodapé com Garantia */}
        <div className="text-center text-xs text-slate-400 space-y-1">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Garantia de Satisfação & Atendimento Profissional</span>
          </p>
          <p>{company.phone} • {company.email}</p>
        </div>
      </div>
    </div>
  );
}
