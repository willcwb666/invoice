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
  ShieldCheck,
} from "lucide-react";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleMarkAsPaid = async () => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      if (res.ok) {
        const json = await res.json();
        setInvoice(json.data);
      }
    } catch (e) {
      console.error("Erro ao marcar fatura como paga:", e);
    } finally {
      setUpdatingStatus(false);
    }
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

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/pay/${invoice.id}` : "";

  const copyPaymentLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappMessage = encodeURIComponent(
    `Hi ${invoice.client?.name || ""}, here is your invoice #${invoice.invoiceNumber} for $${Number(invoice.totalAmount).toFixed(2)}: ${publicUrl}\nThank you for your business!`
  );

  return (
    <div>
      <Header
        title={`Fatura ${invoice.invoiceNumber}`}
        subtitle={`Cliente: ${invoice.client?.name}`}
      />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
          <Link
            href="/invoices"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Lista de Faturas</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === "PAID" ? (
              <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Paga (PAID)</span>
              </span>
            ) : (
              <button
                onClick={handleMarkAsPaid}
                disabled={updatingStatus}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{updatingStatus ? "Atualizando..." : "Marcar como Paga (PAID)"}</span>
              </button>
            )}

            <button
              onClick={copyPaymentLink}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? "Link Copiado!" : "Copiar Link de Pagamento"}</span>
            </button>

            <a
              href={`https://wa.me/?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Enviar WhatsApp / SMS</span>
            </a>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Salvar PDF</span>
            </button>
          </div>
        </div>

        {/* INVOICE CARD (Visual Idêntico aos PDFs Reais) */}
        <div className="p-8 sm:p-12 rounded-2xl bg-white text-slate-900 shadow-2xl space-y-8 font-sans border border-slate-200">
          {/* Header Title */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-normal text-slate-900 tracking-tight">Invoice</h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  invoice.status === "PAID"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-amber-100 text-amber-800 border border-amber-300"
                }`}
              >
                {invoice.status}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs text-slate-700 border-b border-slate-300 pb-4">
              <div>
                <p className="font-semibold text-slate-900 text-sm">Renata Matos de Oliveira</p>
                <p className="font-mono">{invoice.providerAddress || "4172 MeadowView - Evans, CO - 80620"}</p>
              </div>
              <div className="sm:text-right">
                <p>renatamatoz@gmail.com</p>
                <p className="font-semibold text-slate-900">970 412 9406</p>
              </div>
            </div>
          </div>

          {/* Billing Info & Billed To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-slate-300 pb-6">
            <div className="space-y-1">
              <span className="font-bold text-slate-900 block mb-2">Billing Information:</span>
              <p>
                <strong className="text-slate-700">Invoice No.:</strong>{" "}
                <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
              </p>
              <p>
                <strong className="text-slate-700">Invoice Date:</strong>{" "}
                {new Date(invoice.issueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-900 block mb-2">Billed to:</span>
              <p className="font-bold text-slate-900 text-sm">{invoice.client?.name}</p>
              <p className="text-slate-600">{invoice.client?.address}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b-2 border-slate-900 text-slate-900 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 text-left w-24">Date</th>
                  <th className="py-2.5 text-left">Service</th>
                  <th className="py-2.5 text-right w-24">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-3 text-slate-600 font-mono">
                      {item.serviceDate
                        ? new Date(item.serviceDate).toLocaleDateString("en-US")
                        : new Date(invoice.issueDate).toLocaleDateString("en-US")}
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
          <div className="flex justify-end pt-4">
            <div className="w-64 space-y-1.5 text-xs text-right border-t border-slate-300 pt-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-bold font-mono text-slate-900">
                  ${Number(invoice.subtotal || invoice.totalAmount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Discount 0%:</span>
                <span className="font-mono text-slate-600">$0.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tax 0%:</span>
                <span className="font-mono text-slate-600">$0.00</span>
              </div>
              <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-sm">
                <span className="font-bold text-slate-900">Balance Due:</span>
                <span className="font-bold font-mono text-slate-900 text-base">
                  ${Number(invoice.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Terms, Payment Methods & Signature */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs border-t border-slate-300 pt-6">
            <div className="space-y-3">
              <div>
                <span className="font-bold text-slate-900 block mb-1">Terms:</span>
                <p className="text-slate-600">Payment is due within 7 days of invoice date.</p>
                <p className="text-slate-600">Late payments are subject to a 1.5% monthly finance charge.</p>
              </div>

              {/* Digital Signature Vector */}
              <div className="pt-2">
                <span className="text-[10px] text-slate-400 block mb-1 font-mono">Digital Signature:</span>
                <div className="font-serif italic text-2xl text-blue-800 tracking-wider font-semibold py-1">
                  Renata Matos
                </div>
              </div>
            </div>

            <div className="space-y-1.5 sm:text-right">
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
          <div className="border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500">
            If you have any questions regarding this invoice, please contact Renata Matos de Oliveira at the email above.
            <br />
            <strong>Thank you for your business.</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
