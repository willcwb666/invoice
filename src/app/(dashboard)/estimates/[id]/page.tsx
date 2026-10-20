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
  Mail,
  Printer,
  Copy,
  Download,
  Send,
  Loader2,
  AlertCircle,
  Building2,
  Home,
  Sparkles,
  Phone,
  Clock,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { motion, AnimatePresence } from "framer-motion";

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

  // Email modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/estimates/${estimateId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setEstimate(json.data);
            if (json.data.client?.email) {
              setTargetEmail(json.data.client.email);
            }
            return;
          }
        }
        // Fallback
        const listRes = await fetch("/api/v1/estimates");
        if (listRes.ok) {
          const json = await listRes.json();
          const found = json.data?.find((est: any) => est.id === estimateId);
          setEstimate(found);
          if (found?.client?.email) {
            setTargetEmail(found.client.email);
          }
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
        showToast(`Status atualizado para ${newStatus}.`, "success");
      }
    } catch (e) {
      console.error(e);
      showToast("Erro ao atualizar status.", "error");
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
          showToast("Orçamento convertido com sucesso!", "success");
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

  const handlePrintPdf = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim()) {
      setEmailError("Informe um endereço de e-mail válido.");
      return;
    }
    setSendingEmail(true);
    setEmailError(null);

    try {
      const res = await fetch(`/api/v1/estimates/${estimateId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao enviar e-mail.");
      }

      showToast(`Orçamento enviado com sucesso para ${targetEmail}!`, "success");
      setIsEmailModalOpen(false);
      // Auto update status to SENT
      if (estimate.status === "DRAFT") {
        setEstimate((prev: any) => ({ ...prev, status: "SENT" }));
      }
    } catch (err: any) {
      setEmailError(err.message || "Falha ao enviar e-mail.");
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Header title="Carregando orçamento..." />
        <div className="p-12 text-center text-xs text-slate-400">Carregando dados...</div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Header title="Orçamento não encontrado" />
        <div className="p-12 text-center space-y-4">
          <p className="text-xs text-slate-400">Este orçamento não foi localizado no sistema.</p>
          <Link
            href="/estimates"
            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold"
          >
            Voltar para Lista
          </Link>
        </div>
      </div>
    );
  }

  const meta = estimate.metadata || {};

  return (
    <div className="bg-[#f8fafc] min-h-screen print:bg-white print:p-0">
      {/* Header na interface web (oculto na impressão) */}
      <Header
        title={`Orçamento ${estimate.estimateNumber}`}
        subtitle={`Cliente: ${estimate.client?.name}`}
      />

      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 print:p-0 print:m-0 print:max-w-none">
        {/* Navigation & Action Bar (oculto na impressão) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <Link
            href="/estimates"
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Lista de Orçamentos</span>
          </Link>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-2">
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

            {/* Enviar por E-mail */}
            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors cursor-pointer"
              title="Enviar orçamento por e-mail"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar por E-mail</span>
            </button>

            {/* Exportar / Baixar em PDF */}
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
              title="Exportar ou salvar orçamento em formato PDF oficial"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar em PDF</span>
            </button>

            {/* Link direto */}
            <button
              onClick={handleCopyLink}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
              title={copied ? "Link Copiado!" : "Copiar Link"}
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Converter em Fatura */}
            {estimate.status !== "CONVERTED" && (
              <button
                onClick={handleConvertToInvoice}
                disabled={converting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{converting ? "Convertendo..." : "Converter em Invoice Oficial"}</span>
              </button>
            )}

            {estimate.status === "CONVERTED" && estimate.convertedInvoiceId && (
              <Link
                href={`/invoices/${estimate.convertedInvoiceId}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Ver Fatura Gerada</span>
              </Link>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* DOCUMENTO OFICIAL DO ORÇAMENTO (DOCUMENT SHEET)          */}
        {/* ======================================================== */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200 text-slate-900 space-y-8 print:shadow-none print:border-none print:p-0 print:rounded-none">
          {/* Header da Empresa & Título */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b-2 border-slate-100 pb-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200/80 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Professional Cleaning Estimate
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Renata Matos de Oliveira
              </h1>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Residential & Commercial Cleaning Services
              </p>
              <div className="text-xs text-slate-600 pt-1 space-y-0.5">
                <p>4172 MeadowView • Evans, CO 80620</p>
                <p>Phone: (970) 412-9406 • Email: renatamatoz@gmail.com</p>
              </div>
            </div>

            {/* Número e Datas */}
            <div className="sm:text-right space-y-1">
              <div className="inline-block px-3 py-1 rounded-xl bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider mb-2">
                Nº: {estimate.estimateNumber}
              </div>
              <p className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Data de Emissão:</span>{" "}
                {new Date(estimate.issueDate || estimate.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Válido Até:</span>{" "}
                <span className="font-bold text-amber-800">
                  {new Date(estimate.validUntil).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </p>
              <div className="pt-1">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-slate-50 border-slate-200 text-slate-700">
                  Status: {estimate.status}
                </span>
              </div>
            </div>
          </div>

          {/* Dados do Cliente & Endereço do Serviço */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Cliente / Prepared For
              </span>
              <p className="text-sm font-bold text-slate-900">{estimate.client?.name}</p>
              <p className="text-slate-600">
                {estimate.client?.email || "Sem e-mail cadastrado"}
              </p>
              <p className="text-slate-600 font-mono">
                {estimate.client?.phone || "Sem telefone informado"}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Local de Execução / Service Location
              </span>
              <p className="text-slate-800 font-medium leading-relaxed">
                {estimate.client?.address || "Endereço principal da cliente"}
              </p>
              {meta.cleaningType && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-700">
                    Tipo: {meta.cleaningType}
                  </span>
                  {meta.frequency && (
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-700">
                      Frequência: {meta.frequency}
                    </span>
                  )}
                  {meta.sqFt > 0 && (
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-700">
                      {meta.sqFt} sq ft
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabela de Serviços e Itens */}
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-slate-900 font-black uppercase tracking-wider">
                    <th className="py-2.5 text-left">Descrição do Serviço / Add-on</th>
                    <th className="py-2.5 text-center w-20">Qtd</th>
                    <th className="py-2.5 text-right w-28">Preço Unitário</th>
                    <th className="py-2.5 text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estimate.items?.map((it: any) => (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="py-3 text-slate-800 font-medium pr-4 leading-relaxed">
                        {it.description}
                      </td>
                      <td className="py-3 text-center text-slate-600 font-mono">
                        {it.quantity}
                      </td>
                      <td className="py-3 text-right text-slate-600 font-mono">
                        ${Number(it.unitPrice).toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-bold text-slate-900 font-mono">
                        ${Number(it.total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Breakdown & Totais */}
            <div className="pt-4 border-t-2 border-slate-900 flex flex-col items-end space-y-1.5 text-xs">
              <div className="w-full sm:w-80 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal dos Serviços:</span>
                  <span className="font-mono font-medium">
                    ${Number(estimate.subtotal).toFixed(2)}
                  </span>
                </div>

                {Number(estimate.discount) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Desconto de Fidelidade / Recorrência:</span>
                    <span className="font-mono">
                      -${Number(estimate.discount).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                  <span className="font-black text-slate-900 text-sm">
                    VALOR TOTAL ESTIMADO:
                  </span>
                  <span className="font-black font-mono text-2xl text-amber-700">
                    ${Number(estimate.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notas e Termos */}
          {estimate.notes && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1 leading-relaxed">
              <span className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                Termos & Condições do Orçamento:
              </span>
              <p className="text-slate-600">{estimate.notes}</p>
            </div>
          )}

          {/* Garantia & Equipamentos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
            <div>
              <p className="font-bold text-slate-800 mb-0.5">Garantia & Produtos:</p>
              <p>
                Todos os produtos profissionais de limpeza e equipamentos (aspiradores, panos de microfibra, mop) são fornecidos pela nossa equipe. Garantia de satisfação de 24 horas.
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-800 mb-0.5">Formas de Pagamento Aceitas:</p>
              <p>Zelle: (970) 412-9406 • Venmo: @RenataMatoz • Check ou Dinheiro.</p>
            </div>
          </div>

          {/* Campo de Assinatura para Aceite Formal */}
          <div className="pt-8 border-t border-dashed border-slate-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs text-slate-600">
              <div className="space-y-4">
                <div className="border-b border-slate-400 h-6" />
                <p className="text-[11px] text-slate-500">
                  Assinatura do Cliente (Aceite da Proposta)
                </p>
              </div>
              <div className="space-y-4">
                <div className="border-b border-slate-400 h-6" />
                <p className="text-[11px] text-slate-500">Data de Aprovação: _____ / _____ / ________</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL PARA ENVIAR ORÇAMENTO POR E-MAIL                   */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isEmailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Enviar Orçamento por E-mail
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Disparo imediato da proposta com resumo e link para o cliente
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {emailError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{emailError}</span>
                </div>
              )}

              <form onSubmit={handleSendEmail} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    E-mail do Destinatário *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="cliente@email.com"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    O cliente receberá uma mensagem em inglês com todos os detalhes e o link do orçamento.
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-700 block text-[11px]">
                    Resumo do Envio:
                  </span>
                  <p className="text-slate-600 text-[11px]">
                    Orçamento #{estimate.estimateNumber} • Valor: ${Number(estimate.totalAmount).toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(false)}
                    disabled={sendingEmail}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={sendingEmail}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {sendingEmail ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Disparar E-mail</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
