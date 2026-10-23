"use client";

import React, { useState, useEffect } from "react";
import { X, Navigation, MessageSquare, Send, Loader2, Clock } from "lucide-react";

interface EnRouteModalProps {
  appointmentId: string;
  clientName: string;
  clientAddress: string;
  onClose: () => void;
}

export function EnRouteModal({
  appointmentId,
  clientName,
  clientAddress,
  onClose,
}: EnRouteModalProps) {
  const [loading, setLoading] = useState(true);
  const [etaMinutes, setEtaMinutes] = useState(20);
  const [message, setMessage] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [smsUrl, setSmsUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");

  useEffect(() => {
    async function fetchEta() {
      try {
        const res = await fetch(`/api/v1/appointments/${appointmentId}/en-route`, {
          method: "POST",
        });
        if (res.ok) {
          const json = await res.json();
          setEtaMinutes(json.etaMinutes || 20);
          setMessage(json.message || "");
          setClientPhone(json.clientPhone || "");
          setSmsUrl(json.smsUrl || "");
          setWhatsappUrl(json.whatsappUrl || "");
        }
      } catch (err) {
        console.error("Erro ao calcular rota:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEta();
  }, [appointmentId]);

  const handleMessageChange = (newMsg: string) => {
    setMessage(newMsg);
    const cleanPhone = clientPhone.replace(/\D/g, "");
    const encoded = encodeURIComponent(newMsg);
    setSmsUrl(cleanPhone ? `sms:${cleanPhone}?body=${encoded}` : `sms:?body=${encoded}`);
    setWhatsappUrl(cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-base">Avisar "A Caminho"</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs">Calculando tempo de rota GPS...</span>
            </div>
          ) : (
            <>
              {/* ETA Display Card */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Previsão de Chegada (ETA)
                  </span>
                  <div className="text-2xl font-black text-emerald-900 mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-5 h-5 text-emerald-600" />
                    <span>~{etaMinutes} min</span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-emerald-700 max-w-[160px] truncate">
                  {clientAddress}
                </div>
              </div>

              {/* Message Preview & Edit */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Mensagem que será enviada ao cliente:
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-emerald-500 text-slate-800 leading-relaxed resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {smsUrl && (
                  <a
                    href={smsUrl}
                    onClick={onClose}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Enviar por SMS (iMessage)</span>
                  </a>
                )}
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar por WhatsApp</span>
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
