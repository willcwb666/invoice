"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, CheckCircle2, MessageCircle, Phone, Mail, Loader2 } from "lucide-react";

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

  const clientName = invoice.client?.name || "Cliente";
  const clientPhone = invoice.client?.phone || "";
  const clientEmail = invoice.client?.email || "";
  const amount = Number(invoice.totalAmount).toFixed(2);
  const publicPayUrl = typeof window !== "undefined" ? `${window.location.origin}/pay/${invoice.id}` : "";

  const defaultMessage = `Olá ${clientName}! Segue sua fatura #${invoice.invoiceNumber} no valor de $${amount}.\nVocê pode visualizar os detalhes e efetuar o pagamento pelo link: ${publicPayUrl}\nObrigada pela preferência!`;

  const handleSend = async () => {
    setSending(true);

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

      // 3. If Email is selected
      if (sendEmail && clientEmail) {
        await fetch(`/api/v1/invoices/${invoice.id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: clientEmail }),
        }).catch(() => null);
      }

      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Erro ao enviar fatura:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Enviar Fatura #{invoice.invoiceNumber}</h3>
                  <p className="text-xs text-slate-500">Selecione os canais de envio desejados</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
