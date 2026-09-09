"use client";

import React, { useState, useEffect, use } from "react";
import { Printer, CheckCircle2, Phone, Mail, FileText } from "lucide-react";

export default function PublicInvoicePayPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    fetch(`/api/v1/public/invoices/${invoiceId}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((json) => {
        setInvoice(json?.data || null);
      })
      .catch(() => setInvoice(null))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Loading invoice...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl shadow-md space-y-2">
        <h2 className="text-xl font-bold text-slate-800">Invoice not found</h2>
        <p className="text-xs text-slate-500">Please check the link provided by the sender.</p>
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
