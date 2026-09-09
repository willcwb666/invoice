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
import { useToast } from "@/components/ui/toast";

export default function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const estimateId = resolvedParams.id;
  const router = useRouter();
  const { showToast, confirmAction } = useToast();

  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/estimates/${estimateId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setEstimate(json.data);
            return;
          }
        }
        // Fallback
        const listRes = await fetch("/api/v1/estimates");
        if (listRes.ok) {
          const json = await listRes.json();
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

  // Auto trigger print if ?print=true
  useEffect(() => {
    if (typeof window !== "undefined" && !loading && estimate) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("print") === "true") {
        setTimeout(() => window.print(), 600);
      }
    }
  }, [loading, estimate]);

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/v1/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const json = await res.json();
        setEstimate(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConvertToInvoice = () => {
    confirmAction("Convertendo orçamento em Fatura oficial...", async () => {
      setConverting(true);
      try {
        const res = await fetch(`/api/v1/estimates/${estimateId}/convert`, {
          method: "POST",
        });

        const json = await res.json();
        if (res.ok && json.data?.id) {
          router.push(`/invoices/${json.data.id}`);
        } else {
          showToast(json.error || "Erro ao converter orçamento.", "error");
        }
      } catch (e) {
        console.error(e);
        showToast("Erro ao converter orçamento.", "error");
      } finally {
        setConverting(false);
      }
    });
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="bg-[#f8fafc] min-h-screen">
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

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* Status change actions */}
            {estimate.status !== "ACCEPTED" && estimate.status !== "CONVERTED" && (
              <button
                onClick={() => handleStatusChange("ACCEPTED")}
                disabled={updatingStatus}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Marcar Aceito</span>
              </button>
            )}

            {/* Print button */}
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
              title="Imprimir / Salvar PDF"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
              title={copied ? "Link Copiado!" : "Copiar Link"}
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Botão de Ação: Converter em Invoice */}
            {estimate.status !== "CONVERTED" && (
              <button
                onClick={handleConvertToInvoice}
                disabled={converting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{converting ? "Convertendo..." : "Converter em Invoice Oficial"}</span>
              </button>
            )}

            {estimate.status === "CONVERTED" && estimate.convertedInvoiceId && (
              <Link
                href={`/invoices/${estimate.convertedInvoiceId}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Ver Fatura Gerada</span>
              </Link>
            )}
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
