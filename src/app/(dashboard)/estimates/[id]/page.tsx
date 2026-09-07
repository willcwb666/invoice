"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import {
  Receipt,
  ArrowLeft,
  Calendar,
  FileText,
  CheckCircle2,
  Share2,
  Clock,
  Printer,
  Copy,
} from "lucide-react";

export default function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const estimateId = resolvedParams.id;
  const router = useRouter();

  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/estimates");
        if (res.ok) {
          const json = await res.json();
          const found = json.data?.find((est: any) => est.id === estimateId);
          setEstimate(found);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [estimateId]);

  const handleConvertToInvoice = async () => {
    if (!confirm("Deseja converter este orçamento diretamente em Fatura oficial?")) return;
    setConverting(true);
    try {
      const res = await fetch("/api/v1/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: estimate.clientId,
          invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          status: "PENDING",
          notes: `Convertido do orçamento ${estimate.estimateNumber}`,
          items: estimate.items?.map((it: any) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
        }),
      });

      const json = await res.json();
      if (res.ok && json.data?.id) {
        router.push(`/invoices/${json.data.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="Carregando orçamento..." />
        <div className="p-12 text-center text-xs text-slate-400">Carregando dados...</div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div>
        <Header title="Orçamento não encontrado" />
        <div className="p-12 text-center space-y-4">
          <p className="text-xs text-slate-400">Este orçamento não existe.</p>
          <Link href="/estimates" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={`Orçamento ${estimate.estimateNumber}`}
        subtitle={`Cliente: ${estimate.client?.name}`}
      />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/estimates"
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Lista de Orçamentos</span>
          </Link>

          {/* Botão de Ação: Converter em Invoice */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleConvertToInvoice}
              disabled={converting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>{converting ? "Convertendo..." : "Converter em Invoice Oficial"}</span>
            </button>
          </div>
        </div>

        {/* Card de Orçamento Visual */}
        <div className="p-8 rounded-2xl bg-white text-slate-900 shadow-2xl space-y-6 border border-slate-200">
          <div className="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Estimate / Quote</h2>
              <p className="text-xs text-slate-500 font-mono mt-1">Nº: {estimate.estimateNumber}</p>
            </div>
            <div className="text-right text-xs">
              <span className="font-bold text-slate-900 block">Renata Matos de Oliveira</span>
              <span className="text-slate-600">Evans, CO • (970) 412-9406</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-200 pb-4">
            <div>
              <span className="font-bold text-slate-900 block mb-1">Cliente:</span>
              <p className="text-slate-800 font-bold">{estimate.client?.name}</p>
              <p className="text-slate-600">{estimate.client?.email || estimate.client?.phone}</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-900 block mb-1">Validade:</span>
              <p className="text-slate-700">
                Até {new Date(estimate.validUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead className="border-b border-slate-300 font-bold text-slate-900">
              <tr>
                <th className="py-2 text-left">Item / Serviço</th>
                <th className="py-2 text-center w-20">Qtd</th>
                <th className="py-2 text-right w-24">Valor</th>
                <th className="py-2 text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estimate.items?.map((it: any) => (
                <tr key={it.id}>
                  <td className="py-3 text-slate-800 font-medium">{it.description}</td>
                  <td className="py-3 text-center text-slate-600">{it.quantity}</td>
                  <td className="py-3 text-right text-slate-600 font-mono">${Number(it.unitPrice).toFixed(2)}</td>
                  <td className="py-3 text-right font-bold text-slate-900 font-mono">
                    ${Number(it.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-slate-900 pt-4 text-right">
            <span className="text-xs text-slate-600 mr-3">Valor Total Estimado:</span>
            <span className="text-xl font-bold font-mono text-slate-900">
              ${Number(estimate.totalAmount).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
