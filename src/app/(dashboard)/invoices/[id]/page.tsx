"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import {
  FileText,
  Printer,
  Share2,
  CheckCircle2,
  ArrowLeft,
  Copy,
  ExternalLink,
  MessageCircle,
  Clock,
  QrCode,
  Send,
  Building2,
} from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { PaymentModal } from "@/components/ui/payment-modal";
import { SendModal } from "@/components/ui/send-modal";
import { SignatureDisplay } from "@/components/ui/signature-display";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/invoices/${invoiceId}`);
        if (res.ok) {
          const json = await res.json();
          setInvoice(json.data);
        } else {
          const listRes = await fetch("/api/v1/invoices");
          if (listRes.ok) {
            const json = await listRes.json();
            const found = json.data?.find((inv: any) => inv.id === invoiceId);
            setInvoice(found);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId]);

  // Auto trigger print if ?print=true is in URL
  useEffect(() => {
    if (typeof window !== "undefined" && !loading && invoice) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("print") === "true") {
        setTimeout(() => window.print(), 600);
      }
    }
  }, [loading, invoice]);

  const handleToggleStatus = async () => {
    if (!invoice) return;
    const nextStatus = invoice.status === "PAID" ? "PENDING" : "PAID";
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const json = await res.json();
        setInvoice(json.data);
      }
    } catch (e) {
      console.error("Erro ao alternar status da fatura:", e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const copyDirectPaymentLink = () => {
    if (typeof window === "undefined" || !invoice) return;
    const publicUrl = `${window.location.origin}/pay/${invoice.id}`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div>
        <Header title="Carregando fatura..." />
        <div className="p-12 text-center text-xs text-slate-400">Carregando dados da fatura...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div>
        <Header title="Fatura não encontrada" />
        <div className="p-12 text-center space-y-4">
          <p className="text-xs text-slate-400">Esta fatura não existe ou foi removida.</p>
          <Link
            href="/invoices"
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold inline-block"
          >
            Voltar para Faturas
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === "PAID";

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title={`Fatura ${invoice.invoiceNumber}`}
        subtitle={`Cliente: ${invoice.client?.name}`}
      />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Top Control Bar with ONLY discreet icons with tooltips */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
          <Link
            href="/invoices"
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Lista de Faturas</span>
          </Link>

          {/* Action buttons: ICON ONLY with tooltips */}
          <div className="flex items-center justify-end gap-2">
            {/* Ícone Marcar como Paga (Laranja se pendente, Verde se pago) */}
            <ActionButton
              icon={
                isPaid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-600" />
                )
              }
              tooltip={
                updatingStatus
                  ? "Atualizando status..."
                  : isPaid
                  ? "Fatura Paga (Clique para marcar como Pendente)"
                  : "Fatura Pendente (Clique para marcar como Paga)"
              }
              activeColor={isPaid ? "green" : "orange"}
              hoverColor={isPaid ? "green" : "orange"}
              onClick={handleToggleStatus}
              disabled={updatingStatus}
            />

            {/* Ícone Gerar link de pagamento (Zelle / Venmo QR Code) */}
            <ActionButton
              icon={<QrCode className="w-4 h-4" />}
              tooltip="Gerar Link & QR Code de Pagamento (Zelle / Venmo)"
              hoverColor="yellow"
              onClick={() => setIsPaymentModalOpen(true)}
            />

            {/* Ícone Copiar Link Direto */}
            <ActionButton
              icon={
                copied ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )
              }
              tooltip={copied ? "Link Copiado com Sucesso!" : "Copiar Link Público de Pagamento"}
              hoverColor="yellow"
              onClick={copyDirectPaymentLink}
            />

            {/* Ícone Enviar (WhatsApp, SMS, E-mail) */}
            <ActionButton
              icon={<Send className="w-4 h-4" />}
              tooltip="Enviar Fatura (WhatsApp, SMS, E-mail)"
              hoverColor="purple"
              onClick={() => setIsSendModalOpen(true)}
            />

            {/* Ícone Imprimir / Salvar PDF */}
            <ActionButton
              icon={<Printer className="w-4 h-4" />}
              tooltip="Imprimir / Salvar PDF"
              hoverColor="blue"
              onClick={() => window.print()}
            />
          </div>
        </div>

        {/* INVOICE CARD (Visual e Layout Idêntico aos PDFs Reais de Exemplo) */}
        <div className="p-8 sm:p-12 rounded-3xl bg-white text-slate-900 shadow-xl space-y-8 font-sans border border-slate-200/90 print:p-0 print:border-none print:shadow-none">
          {/* Header Title & Company info */}
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                {/* Logo spot (preparado caso exista ou futuro upload) */}
                {invoice.company?.logoUrl ? (
                  <img
                    src={invoice.company.logoUrl}
                    alt="Logo"
                    className="h-12 w-auto object-contain rounded-lg"
                  />
                ) : null}
                <h1 className="text-3xl sm:text-4xl font-normal text-slate-900 tracking-tight">
                  Invoice
                </h1>
              </div>

              <div className="text-right text-xs text-slate-700">
                <p>renatamatoz@gmail.com</p>
                <p className="font-semibold text-slate-900">970 412 9406</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs text-slate-700 border-b border-slate-300 pb-4">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {invoice.company?.name || "Renata Matos de Oliveira"}
                </p>
                <p className="font-mono">
                  {invoice.providerAddress || "4172 MeadowView - Evans, CO - 80620"}
                </p>
              </div>
            </div>
          </div>

          {/* Billing Information & Billed To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-slate-300 pb-6">
            <div className="space-y-1">
              <span className="font-bold text-slate-900 block mb-2 text-[13px]">
                Billing Information:
              </span>
              <p>
                <strong className="text-slate-700">Invoice No.:</strong>{" "}
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {invoice.invoiceNumber}
                </span>
              </p>
              <p>
                <strong className="text-slate-700">Invoice Date:</strong>{" "}
                {new Date(invoice.issueDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="space-y-1 sm:text-left">
              <span className="font-bold text-slate-900 block mb-2 text-[13px]">
                Billed to:
              </span>
              <p className="font-bold text-slate-900 text-sm">{invoice.client?.name}</p>
              <p className="text-slate-600">{invoice.client?.address}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b-2 border-slate-900 text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 text-left w-28">DATE</th>
                  <th className="py-2.5 text-left">SERVICE</th>
                  <th className="py-2.5 text-right w-28">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-3 text-slate-600 font-mono">
                      {item.serviceDate
                        ? new Date(item.serviceDate).toLocaleDateString("en-US", {
                            month: "2-digit",
                            day: "2-digit",
                            year: "numeric",
                          })
                        : new Date(invoice.issueDate).toLocaleDateString("en-US", {
                            month: "2-digit",
                            day: "2-digit",
                            year: "numeric",
                          })}
                    </td>
                    <td className="py-3 text-slate-900 font-medium">{item.description}</td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900">
                      ${Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end pt-2">
            <div className="w-72 space-y-2 text-xs text-right">
              <div className="flex justify-between border-t border-slate-400 pt-2">
                <span className="font-bold text-slate-900">Subtotal</span>
                <span className="font-bold font-mono text-slate-900">
                  ${Number(invoice.subtotal || invoice.totalAmount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-600">Discount 0%</span>
                <span className="font-mono text-slate-600">$0.00</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-600">Tax 0%</span>
                <span className="font-mono text-slate-600">$0.00</span>
              </div>
              <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-sm">
                <span className="font-bold text-slate-900">Balance Due</span>
                <span className="font-bold font-mono text-slate-900 text-base">
                  ${Number(invoice.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Terms, Payment Methods & Signature identical to example PDF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs border-t border-slate-300 pt-6">
            <div className="space-y-4">
              <div>
                <span className="font-bold text-slate-900 block mb-1">Terms</span>
                <p className="text-slate-600">Payment is due within 7 days of invoice date.</p>
                <p className="text-slate-600">
                  Late payments are subject to a 1.5% monthly finance change.
                </p>
              </div>

              {/* Real Signature from Example PDF */}
              <div className="pt-1">
                <SignatureDisplay
                  signatureUrl={invoice.company?.signatureUrl}
                  className="h-20 max-w-[260px]"
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:text-left">
              <span className="font-bold text-slate-900 block mb-1">Payments methods:</span>
              <p className="text-slate-700">
                <strong className="text-slate-900">Zelle:</strong> 9704129406
              </p>
              <p className="text-slate-700">
                <strong className="text-slate-900">Venmo:</strong> @RenataMatoz
              </p>
              <p className="text-slate-700">
                <strong className="text-slate-900">Check payable to:</strong> Renata Matos de Oliveira
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-300 pt-4 text-xs text-slate-600 space-y-1">
            <p>
              If you have any questions regarding this invoice, please contact Renata Matos de Oliveira at the email above.
            </p>
            <p className="font-medium text-slate-900">Thank you for your business.</p>
          </div>
        </div>
      </div>

      {/* Payment Modal (Zelle / Venmo QR Code) */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        invoice={invoice}
      />

      {/* Send Modal (WhatsApp / SMS / Email) */}
      <SendModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        invoice={invoice}
      />
    </div>
  );
}
