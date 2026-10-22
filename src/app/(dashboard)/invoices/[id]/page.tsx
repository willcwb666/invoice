"use client";

import React, { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import {
  FileText,
  Printer,
  Image as ImageIcon,
  Download,
  Loader2,
  Share2,
  CheckCircle2,
  ArrowLeft,
  Copy,
  ExternalLink,
  MessageCircle,
  Clock,
  AlertCircle,
  QrCode,
  Send,
  Building2,
} from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { PaymentModal } from "@/components/ui/payment-modal";
import { SendModal } from "@/components/ui/send-modal";
import { SignatureDisplay } from "@/components/ui/signature-display";
import { toPng, toJpeg } from "html-to-image";
import { ModalShell } from "@/components/ui/modal-shell";

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

  // Modals & Export
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const invoiceCardRef = useRef<HTMLDivElement>(null);

  const handleExportImage = async (format: "png" | "jpeg" = "png") => {
    if (!invoiceCardRef.current || !invoice) return;
    setExportingImage(true);
    try {
      const fn = format === "png" ? toPng : toJpeg;
      const dataUrl = await fn(invoiceCardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `Invoice-${invoice.invoiceNumber}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erro ao gerar imagem da fatura:", err);
      alert("Não foi possível gerar a imagem no navegador.");
    } finally {
      setExportingImage(false);
    }
  };

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
  const isOverdue = invoice.status === "OVERDUE";

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
            {/* Ícone Marcar como Paga (verde=paga, vermelho=vencida, amarelo=pendente) */}
            <ActionButton
              icon={
                isPaid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : isOverdue ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-600" />
                )
              }
              tooltip={
                updatingStatus
                  ? "Atualizando status..."
                  : isPaid
                  ? "Fatura Paga (Clique para marcar como Pendente)"
                  : isOverdue
                  ? "Fatura Vencida (Clique para marcar como Paga)"
                  : "Fatura Pendente (Clique para marcar como Paga)"
              }
              activeColor={isPaid ? "green" : isOverdue ? "red" : "orange"}
              hoverColor={isPaid ? "green" : isOverdue ? "red" : "orange"}
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

            {/* Escolher Gerar em PDF ou Imagem */}
            <ActionButton
              icon={<Download className="w-4 h-4" />}
              tooltip="Exportar Fatura (Escolher PDF ou Imagem)"
              hoverColor="green"
              onClick={() => setShowExportModal(true)}
            />

            {/* Ícone Gerar Imagem Direta */}
            <ActionButton
              icon={exportingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              tooltip="Baixar como Imagem (PNG de alta resolução)"
              hoverColor="purple"
              disabled={exportingImage}
              onClick={() => handleExportImage("png")}
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
        <div ref={invoiceCardRef} className="p-8 sm:p-12 rounded-3xl bg-white text-slate-900 shadow-xl space-y-8 font-sans border border-slate-200/90 print:p-0 print:border-none print:shadow-none">
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
                <p>{invoice.company?.email}</p>
                <p className="font-semibold text-slate-900">{invoice.company?.phone}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs text-slate-700 border-b border-slate-300 pb-4">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {invoice.company?.tradeName || invoice.company?.name}
                </p>
                <p className="font-mono">{invoice.providerAddress}</p>
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
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-600">Discount</span>
                  <span className="font-mono text-slate-600">
                    -${Number(invoice.discount).toFixed(2)}
                  </span>
                </div>
              )}
              {Number(invoice.tax) > 0 && (
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-600">Tax</span>
                  <span className="font-mono text-slate-600">${Number(invoice.tax).toFixed(2)}</span>
                </div>
              )}
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
                <p className="text-slate-600 whitespace-pre-line">{invoice.company?.terms}</p>
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
              <p className="text-slate-700 whitespace-pre-line">{invoice.company?.paymentMethods}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-300 pt-4 text-xs text-slate-600 space-y-1">
            <p>
              If you have any questions regarding this invoice, please contact{" "}
              {invoice.company?.tradeName || invoice.company?.name} at the email above.
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
        company={invoice?.company}
      />

      {/* Send Modal (WhatsApp / SMS / Email) */}
      <SendModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        invoice={invoice}
      />

      {/* Modal para Escolher Gerar Fatura em PDF ou Imagem */}
      <ModalShell
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        icon={<Download className="w-5 h-5 text-indigo-600" />}
        title="Exportar Fatura"
        subtitle="Escolha se deseja gerar e baixar esta fatura em PDF ou formato de Imagem"
        backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        panelClassName="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5"
        headerRowClassName="flex items-center justify-between"
        headerLeftClassName="flex items-center gap-3"
        iconWrapperClassName="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100"
      >
        <div className="space-y-3 pt-2 text-xs">
          {/* Opção 1: PDF */}
          <div
            onClick={() => {
              setShowExportModal(false);
              window.print();
            }}
            className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Gerar Documento PDF</h4>
                <p className="text-slate-500 text-[11px]">
                  Arquivo oficial vetorial. Abre diálogo para salvar ou imprimir em PDF com nitidez perfeita.
                </p>
              </div>
            </div>
            <Printer className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
          </div>

          {/* Opção 2: Imagem PNG */}
          <div
            onClick={() => {
              setShowExportModal(false);
              handleExportImage("png");
            }}
            className="p-4 rounded-2xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 group-hover:scale-105 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Gerar Imagem PNG (Alta Resolução)</h4>
                <p className="text-slate-500 text-[11px]">
                  Arquivo .png pronto para salvar nas fotos ou enviar diretamente no WhatsApp e iMessage.
                </p>
              </div>
            </div>
            {exportingImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-600 shrink-0" />
            ) : (
              <Download className="w-4 h-4 text-slate-400 group-hover:text-purple-600 shrink-0" />
            )}
          </div>

          {/* Opção 3: Imagem JPEG */}
          <div
            onClick={() => {
              setShowExportModal(false);
              handleExportImage("jpeg");
            }}
            className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:scale-105 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Gerar Imagem JPEG (Leve)</h4>
                <p className="text-slate-500 text-[11px]">
                  Arquivo compacto otimizado para carregamento rápido em redes celulares com pouca conexão.
                </p>
              </div>
            </div>
            {exportingImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
            ) : (
              <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => setShowExportModal(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
