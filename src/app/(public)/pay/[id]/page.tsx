"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { Printer, CheckCircle2, Phone, Mail, FileText, AlertCircle, RefreshCw } from "lucide-react";

export default function PublicInvoicePayPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 404 real ("link errado") não tem por que ter botão de tentar de novo;
  // rede/500 sim, pois é provavelmente passageiro.
  const [canRetry, setCanRetry] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/public/invoices/${invoiceId}`);
      const json = await r.json().catch(() => null);
      if (!r.ok) {
        setCanRetry(r.status !== 404);
        setError(json?.error || "Não foi possível carregar a fatura.");
        return;
      }
      setInvoice(json?.data || null);
    } catch {
      // fetch() rejeitou de verdade (rede/DNS) — sempre vale tentar de novo
      setCanRetry(true);
      setError("Não foi possível conectar ao servidor. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Loading invoice...
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl shadow-md space-y-3 max-w-md mx-auto">
        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">
          {canRetry ? "Não foi possível carregar a fatura" : "Invoice not found"}
        </h2>
        <p className="text-xs text-slate-500">
          {error || "Please check the link provided by the sender."}
        </p>
        {canRetry && (
          <button
            onClick={loadInvoice}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        )}
      </div>
    );
  }

  const companyDisplayName = invoice.company?.tradeName || invoice.company?.name || "";

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <span className="text-xs text-slate-500">Official Invoice from</span>
          <h2 className="text-sm font-bold text-slate-900">{companyDisplayName}</h2>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md inline-flex items-center gap-1.5 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      {/* Official Invoice Sheet */}
      <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-slate-200 space-y-8 font-sans">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-normal text-slate-900 tracking-tight mb-4">Invoice</h1>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs text-slate-700 border-b border-slate-300 pb-4">
            <div>
              <p className="font-semibold text-slate-900 text-sm">{companyDisplayName}</p>
              <p className="font-mono">{invoice.providerAddress}</p>
            </div>
            <div className="sm:text-right">
              <p>{invoice.company?.email}</p>
              <p className="font-semibold text-slate-900">{invoice.company?.phone}</p>
            </div>
          </div>
        </div>

        {/* Billing Info */}
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

        {/* Items */}
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

        {/* Totals */}
        <div className="flex justify-end pt-4">
          <div className="w-64 space-y-1.5 text-xs text-right border-t border-slate-300 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-bold font-mono text-slate-900">
                ${Number(invoice.subtotal || invoice.totalAmount).toFixed(2)}
              </span>
            </div>
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Discount:</span>
                <span className="font-mono text-slate-600">
                  -${Number(invoice.discount).toFixed(2)}
                </span>
              </div>
            )}
            {Number(invoice.tax) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Tax:</span>
                <span className="font-mono text-slate-600">${Number(invoice.tax).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-sm">
              <span className="font-bold text-slate-900">Balance Due:</span>
              <span className="font-bold font-mono text-slate-900 text-base">
                ${Number(invoice.totalAmount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Methods Box */}
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <span className="font-bold text-slate-900 text-sm block">How to Pay:</span>
          <p className="text-slate-700 whitespace-pre-line">{invoice.company?.paymentMethods}</p>
        </div>

        {/* Signature & Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-t border-slate-200 pt-4">
          <div className="space-y-1">
            <span className="font-bold text-slate-900 block">Terms:</span>
            <p className="text-slate-600 whitespace-pre-line">{invoice.company?.terms}</p>
            {invoice.company?.signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={invoice.company.signatureUrl}
                alt="Assinatura"
                className="h-10 object-contain mt-3"
              />
            ) : (
              <div className="pt-3 font-serif italic text-2xl text-blue-800 font-semibold">
                {companyDisplayName}
              </div>
            )}
          </div>
          <div className="text-slate-500 sm:text-right text-[11px] pt-4">
            If you have questions, please contact {companyDisplayName} at {invoice.company?.phone}.<br />
            <strong>Thank you for your business!</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
