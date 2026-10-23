"use client";

import React, { useState } from "react";
import { Check, Copy, ExternalLink, QrCode } from "lucide-react";
import { QRCodeSVG } from "./qr-code";
import { ModalShell } from "@/components/ui/modal-shell";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number | string;
    client?: { name: string };
  };
  /** Company profile as returned alongside the invoice (includes paymentMethods free text) — preferred over the props below. */
  company?: { name?: string | null; tradeName?: string | null; paymentMethods?: string | null };
  /** Explicit overrides. Only needed where `company` isn't available; otherwise derived from `company.paymentMethods`. */
  zellePhone?: string;
  venmoHandle?: string;
  recipientName?: string;
}

const FALLBACK_ZELLE_PHONE = "9704129406";
const FALLBACK_VENMO_HANDLE = "@RenataMatoz";
const FALLBACK_RECIPIENT_NAME = "Renata Matos de Oliveira";

/**
 * `paymentMethods` is free text edited on the Settings page (e.g.
 * "Zelle: 9704129406\nVenmo: @RenataMatoz\nCheck payable to: ..."), not a
 * structured field — this pulls out the two lines this modal needs. Falls
 * back to the hardcoded defaults only when nothing can be parsed, so a
 * differently-worded paymentMethods text degrades instead of going blank.
 */
function parsePaymentMethods(text?: string | null): { zelle?: string; venmo?: string } {
  if (!text) return {};
  const zelleMatch = text.match(/zelle[:\s]+([^\n]+)/i);
  const venmoMatch = text.match(/venmo[:\s]+([^\n]+)/i);
  return {
    zelle: zelleMatch?.[1]?.trim(),
    venmo: venmoMatch?.[1]?.trim(),
  };
}

export function PaymentModal({
  isOpen,
  onClose,
  invoice,
  company,
  zellePhone: zellePhoneProp,
  venmoHandle: venmoHandleProp,
  recipientName: recipientNameProp,
}: PaymentModalProps) {
  const parsed = parsePaymentMethods(company?.paymentMethods);
  const zellePhone = zellePhoneProp || parsed.zelle || FALLBACK_ZELLE_PHONE;
  const venmoHandle = venmoHandleProp || parsed.venmo || FALLBACK_VENMO_HANDLE;
  const recipientName =
    recipientNameProp || company?.tradeName || company?.name || FALLBACK_RECIPIENT_NAME;
  const [method, setMethod] = useState<"zelle" | "venmo">("zelle");
  const [copied, setCopied] = useState(false);

  const cleanVenmo = venmoHandle.replace("@", "");
  const amountNumber = Number(invoice.totalAmount).toFixed(2);
  const memoText = `Invoice ${invoice.invoiceNumber}`;

  // Venmo payment link & deep link
  const venmoUrl = `https://venmo.com/${cleanVenmo}?txn=pay&amount=${amountNumber}&note=${encodeURIComponent(
    memoText
  )}`;

  // Zelle QR data format: standard zelle payload or payment string
  const zelleQrValue = `zelle:${zellePhone}?amount=${amountNumber}&memo=${encodeURIComponent(
    memoText
  )}&name=${encodeURIComponent(recipientName)}`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={<QrCode className="w-5 h-5" />}
      title="Link e QR Code de Pagamento"
      subtitle={`Fatura #${invoice.invoiceNumber} • $${amountNumber}`}
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      panelClassName="w-full max-w-md sm:max-w-xl bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5"
      headerRowClassName="flex items-center justify-between"
      headerLeftClassName="flex items-center gap-2"
      iconWrapperClassName="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100"
      titleClassName="font-bold text-slate-900 text-sm"
      closeButtonClassName="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      closeIconClassName="w-4 h-4"
    >

            {/* Method Tabs: Zelle vs Venmo */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 rounded-2xl">
              <button
                type="button"
                onClick={() => setMethod("zelle")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  method === "zelle"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Zelle
              </button>
              <button
                type="button"
                onClick={() => setMethod("venmo")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  method === "venmo"
                    ? "bg-white text-sky-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Venmo
              </button>
            </div>

            {/* Content for Selected Method */}
            {method === "zelle" ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center p-3 bg-purple-50/50 rounded-2xl border border-purple-100">
                  <QRCodeSVG value={zelleQrValue} size={180} fgColor="#581c87" />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destinatário:</span>
                    <strong className="text-slate-900">{recipientName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Telefone Zelle:</span>
                    <strong className="font-mono text-purple-700">{zellePhone}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Valor a Pagar:</span>
                    <strong className="font-mono font-bold text-slate-900">${amountNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Identificação:</span>
                    <span className="font-mono text-slate-700">{memoText}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(zellePhone)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? "Telefone Copiado!" : "Copiar Telefone Zelle"}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="flex justify-center p-3 bg-sky-50/50 rounded-2xl border border-sky-100">
                  <QRCodeSVG value={venmoUrl} size={180} fgColor="#0369a1" />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destinatário Venmo:</span>
                    <strong className="font-mono text-sky-700">{venmoHandle}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Valor a Pagar:</span>
                    <strong className="font-mono font-bold text-slate-900">${amountNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mensagem / Nota:</span>
                    <span className="font-mono text-slate-700">{memoText}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(venmoUrl)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Link Copiado!" : "Copiar Link"}</span>
                  </button>

                  <a
                    href={venmoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-colors"
                  >
                    <span>Abrir Venmo</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
    </ModalShell>
  );
}
