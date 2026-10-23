"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, AlertCircle, MessageCircle, Phone, Mail, Loader2 } from "lucide-react";
import { ModalShell } from "@/components/ui/modal-shell";

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number | string;
    client?: {
      name: string;
      email?: string | null;
      phone?: string | null;
    };
  };
}

export function SendModal({ isOpen, onClose, invoice }: SendModalProps) {
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const clientName = invoice.client?.name || "Cliente";
  const clientPhone = invoice.client?.phone || "";
  const clientEmail = invoice.client?.email || "";
  const amount = Number(invoice.totalAmount).toFixed(2);
  const publicPayUrl = typeof window !== "undefined" ? `${window.location.origin}/pay/${invoice.id}` : "";

  const defaultMessage = `Olá ${clientName}! Segue sua fatura #${invoice.invoiceNumber} no valor de $${amount}.\nVocê pode visualizar os detalhes e efetuar o pagamento pelo link: ${publicPayUrl}\nObrigada pela preferência!`;

  const handleSend = async () => {
    setSending(true);
    setSendError(null);

    try {
      // 1. If WhatsApp is selected
      if (sendWhatsApp) {
        const cleanPhone = clientPhone.replace(/\D/g, "");
        const waUrl = cleanPhone
          ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMessage)}`
          : `https://wa.me/?text=${encodeURIComponent(defaultMessage)}`;
        window.open(waUrl, "_blank");
      }

      // 2. If SMS is selected
      if (sendSms) {
        const cleanPhone = clientPhone.replace(/\D/g, "");
        const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(defaultMessage)}`;
        window.location.href = smsUrl;
      }

      // 3. If Email is selected — the only channel that actually goes
      // through our own backend and can genuinely fail (Resend not
      // configured, invalid address, etc.), so it's the only one whose
      // result we check before claiming success. WhatsApp/SMS just hand off
      // to the OS, which has no failure signal to check from here.
      if (sendEmail && clientEmail) {
        const res = await fetch(`/api/v1/invoices/${invoice.id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: clientEmail }),
        });
        const json = await res.json().catch(() => ({}) as { error?: string });
        if (!res.ok) {
          throw new Error(json.error || "Falha ao enviar o e-mail.");
        }
      }

      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Erro ao enviar fatura:", err);
      setSendError(err instanceof Error ? err.message : "Ocorreu um erro ao enviar a fatura.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={<Send className="w-5 h-5" />}
      title={`Enviar Fatura #${invoice.invoiceNumber}`}
      subtitle="Selecione os canais de envio desejados"
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      panelClassName="w-full max-w-md sm:max-w-xl bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5"
      headerRowClassName="flex items-center justify-between"
      headerLeftClassName="flex items-center gap-2"
      iconWrapperClassName="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100"
      titleClassName="font-bold text-slate-900 text-sm"
      closeButtonClassName="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      closeIconClassName="w-4 h-4"
    >

            {/* Channels Checklist */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">Canais de Envio:</label>

              {/* WhatsApp */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">WhatsApp</span>
                    <span className="text-[11px] text-slate-500">
                      {clientPhone ? `Enviar para ${clientPhone}` : "Abrir conversa com mensagem pronta"}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendWhatsApp}
                  onChange={(e) => setSendWhatsApp(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </label>

              {/* SMS */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">SMS</span>
                    <span className="text-[11px] text-slate-500">
                      {clientPhone ? `Mensagem de texto para ${clientPhone}` : "App de mensagens do celular"}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendSms}
                  onChange={(e) => setSendSms(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              {/* E-mail */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">E-mail</span>
                    <span className="text-[11px] text-slate-500">
                      {clientEmail ? `Enviar para ${clientEmail}` : "Sem e-mail cadastrado"}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendEmail}
                  disabled={!clientEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer disabled:opacity-40"
                />
              </label>
            </div>

            {sendError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {/* Message Preview */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">Prévia da Mensagem:</span>
              <div className="p-3 bg-slate-100/80 rounded-xl text-[11px] text-slate-700 font-mono whitespace-pre-wrap border border-slate-200">
                {defaultMessage}
              </div>
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || (!sendWhatsApp && !sendSms && !sendEmail)}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : sentSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enviado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Disparar Envios Selecionados</span>
                </>
              )}
            </button>
    </ModalShell>
  );
}
