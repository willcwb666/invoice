"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/dashboard/header";
import { useToast } from "@/components/ui/toast";
import {
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  Users,
  Award,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  ChevronRight,
  Percent,
  Search,
} from "lucide-react";

type ReportType = "financial" | "appointments";
type PeriodPreset = "current_month" | "last_month" | "quarter" | "year" | "custom";

interface ProfessionalOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
}

// Mesma definição de "atrasado" usada em src/app/(dashboard)/payments/page.tsx:
// não pago e com data anterior a hoje.
function isTransactionOverdue(dateIso: string, isPaid: boolean): boolean {
  if (isPaid) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(dateIso) < startOfToday;
}

export default function ReportsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>("financial");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("current_month");

  // Datas em formato YYYY-MM-DD
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [professionalId, setProfessionalId] = useState("ALL");
  const [clientId, setClientId] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  // Inicializa datas com base no fuso e preset
  useEffect(() => {
    applyPreset("current_month");
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/v1/professionals"),
        fetch("/api/v1/clients"),
      ]);
      if (pRes.ok) {
        const json = await pRes.json();
        setProfessionals(json.data || []);
      }
      if (cRes.ok) {
        const json = await cRes.json();
        setClients(json.data || []);
      }
    } catch (err) {
      console.error("Erro ao carregar filtros do relatório:", err);
      showToast("Erro ao carregar filtros (profissionais/clientes).", "error");
    }
  };

  const applyPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "current_month") {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
    } else if (preset === "last_month") {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
    } else if (preset === "quarter") {
      const start = new Date(y, m - 2, 1);
      const end = new Date(y, m + 1, 0);
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
    } else if (preset === "year") {
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
    }
  };

  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: activeTab,
        startDate,
        endDate,
        professionalId,
        clientId,
        status,
      });
      const res = await fetch(`/api/v1/reports?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setReportData(json);
      }
    } catch (err) {
      console.error("Erro ao carregar relatório:", err);
      showToast("Erro ao carregar relatório.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, startDate, endDate, professionalId, clientId, status]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!reportData) return;

    let csvContent = "data:text/csv;charset=utf-8,";

    if (activeTab === "financial") {
      csvContent += "Tipo,Data,Descricao,Cliente,Modalidade,Valor,Status\n";
      const rows: any[] = [];
      const tx = reportData.transactions || {};
      
      // 1. Receitas da Operação (Atendimentos da Agenda)
      (tx.appointments || []).forEach((a: any) => {
        rows.push([
          "Receita Operacional",
          a.date.split("T")[0],
          `"${a.description.replace(/"/g, '""')}"`,
          `"${(a.clientName || "").replace(/"/g, '""')}"`,
          `"${a.invoiced ? `Faturado (${a.invoiceNumber || "Invoice"})` : "Cobrança Direta"}"`,
          a.grossAmount,
          a.status === "PAID" ? "Recebido" : "Pendente",
        ]);
      });

      // 2. Despesas Operacionais em Campo
      (tx.expenses || []).forEach((e: any) => {
        rows.push([
          "Despesa Operacional",
          e.date.split("T")[0],
          `"${e.description.replace(/"/g, '""')}"`,
          "-",
          `"${e.category}"`,
          `-${e.grossAmount}`,
          "Liquidado",
        ]);
      });

      // 3. Documentos Fiscais / Invoices Emitidas (Informativo)
      if ((tx.invoices || []).length > 0) {
        rows.push(["", "", "", "", "", "", ""]);
        rows.push(["--- FATURAS EMITIDAS NO PERIODO (DOCUMENTOS DE COBRANCA) ---", "", "", "", "", "", ""]);
        rows.push(["Tipo_Doc,Data,Numero_Fatura,Cliente,Forma_Cobranca,Valor_Faturado,Status"]);
        (tx.invoices || []).forEach((i: any) => {
          rows.push([
            "Fatura Comercial",
            i.date.split("T")[0],
            `"${i.description.replace(/"/g, '""')}"`,
            `"${(i.clientName || "").replace(/"/g, '""')}"`,
            `"${i.paymentMethod || "Zelle/Venmo/Check"}"`,
            i.grossAmount,
            i.status,
          ]);
        });
      }

      rows.forEach((row) => {
        csvContent += row.join(",") + "\n";
      });
    } else {
      csvContent += "Data,Titulo,Cliente,Endereco,Modalidade,Equipe,Preco,Status,Pago\n";
      (reportData.items || []).forEach((item: any) => {
        csvContent += [
          item.date.split("T")[0],
          `"${(item.title || "").replace(/"/g, '""')}"`,
          `"${(item.client?.name || "").replace(/"/g, '""')}"`,
          `"${(item.address || "").replace(/"/g, '""')}"`,
          `"${item.cleaningCategory}"`,
          `"${(item.professionals || []).map((p: any) => p.name).join("; ")}"`,
          item.price,
          item.status,
          item.paid ? "Sim" : "Nao",
        ].join(",") + "\n";
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `relatorio_${activeTab}_${startDate}_a_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fmtCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
      val || 0
    );

  const kpis = reportData?.kpis;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        title="Central de Relatórios"
        subtitle="Auditoria contábil, financeira e operacional com exportação e filtros completos"
        onRefresh={fetchReport}
        loading={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full flex-1">
        {/* Cabeçalho de Impressão (Visível apenas na impressão) */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Renata Matos de Oliveira
              </h1>
              <p className="text-xs text-slate-600 font-semibold">
                Professional Cleaning Services • Evans & Greeley, CO • Tel: (970) 412-9406
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase block">
                Relatório Gerencial
              </span>
              <span className="text-sm font-bold text-slate-900">
                {activeTab === "financial" ? "Demonstrativo Financeiro Consolidado" : "Relatório Operacional de Agendamentos"}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-200">
            <span>
              Período de Apuração: <strong>{startDate}</strong> até <strong>{endDate}</strong>
            </span>
            <span>
              Emitido em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Barra de Abas & Ações Rápidas (Oculto na impressão) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-slate-200/70 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("financial")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "financial"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Relatório Financeiro Completo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("appointments")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "appointments"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Relatório de Agendamentos</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-white" />
              <span>Imprimir (salvar como PDF)</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros Avançados (Oculto na impressão) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3.5 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>Filtros do Relatório</span>
            </div>

            {/* Presets Rápidos */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "current_month", label: "Este Mês" },
                  { id: "last_month", label: "Mês Anterior" },
                  { id: "quarter", label: "Últimos 3 Meses" },
                  { id: "year", label: "Ano Vigente" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    periodPreset === p.id
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold"
                      : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/60"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Data Inicial */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPeriodPreset("custom");
                }}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
            </div>

            {/* Data Final */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPeriodPreset("custom");
                }}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
            </div>

            {/* Profissional */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Profissional Escalado
              </label>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-medium"
              >
                <option value="ALL">Todos os Profissionais</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cliente */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Cliente
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-medium"
              >
                <option value="ALL">Todos os Clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-medium"
              >
                <option value="ALL">Todos os Status</option>
                <option value="PAID">Pago / Concluído</option>
                <option value="PENDING">Pendente</option>
                {activeTab === "appointments" && (
                  <>
                    <option value="SCHEDULED">Agendado</option>
                    <option value="CANCELLED">Cancelado</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* =========================================================================
            ABA 1: RELATÓRIO FINANCEIRO COMPLETO
           ========================================================================= */}
        {activeTab === "financial" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Ganhos Totais */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Receita Bruta (Ganhos)</span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {fmtCurrency(kpis?.totalGrossRevenue)}
                </div>
                <p className="text-[11px] text-slate-500">
                  {kpis?.appointmentCount || 0} atendimentos da agenda
                </p>
              </div>

              {/* Total Recebido / Liquidado */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Recebido (Pago)</span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-emerald-600 tracking-tight">
                  {fmtCurrency(kpis?.totalReceived)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Pendente: {fmtCurrency(kpis?.totalPending)}
                </p>
              </div>

              {/* Despesas Operacionais */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Despesas Operacionais</span>
                  <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-rose-600 tracking-tight">
                  {fmtCurrency(kpis?.totalOperationalExpenses)}
                </div>
                <p className="text-[11px] text-slate-500">
                  {kpis?.expenseCount || 0} comprovantes lançados
                </p>
              </div>

              {/* Comissões da Equipe */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Comissões da Equipe</span>
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-amber-600 tracking-tight">
                  {fmtCurrency(kpis?.totalStaffCommissions)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Gastos Totais: {fmtCurrency(kpis?.totalGastos)}
                </p>
              </div>

              {/* Lucro Real Líquido */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-700">
                  <span>Lucro Real Líquido</span>
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-indigo-900 tracking-tight">
                  {fmtCurrency(kpis?.netProfit)}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700">
                  <span>Margem Real:</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-indigo-200/60 font-mono">
                    {kpis?.marginPercent || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* DRE Sintético Gerencial */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                Demonstrativo de Resultado do Exercício (DRE Gerencial)
              </h3>

              <div className="divide-y divide-slate-100 text-xs">
                {/* (+) Receita Bruta Total */}
                <div className="py-2.5 flex items-center justify-between font-bold text-slate-900 bg-slate-50/60 px-3 rounded-lg">
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-600">(+)</span> Receita Bruta da Operação (Total da Agenda)
                  </span>
                  <span className="font-mono text-emerald-700 text-sm">
                    {fmtCurrency(reportData?.dre?.grossRevenueTotal)}
                  </span>
                </div>

                <div className="py-2 pl-8 pr-3 flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-2">
                    <span>• Atendimentos Faturados via Invoice</span>
                    {reportData?.dre?.invoicesEmittedCount > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({reportData?.dre?.invoicesEmittedCount} {reportData?.dre?.invoicesEmittedCount === 1 ? "fatura emitida" : "faturas emitidas"})
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-semibold">{fmtCurrency(reportData?.dre?.grossRevenueInvoices)}</span>
                </div>

                <div className="py-2 pl-8 pr-3 flex items-center justify-between text-slate-600">
                  <span>• Atendimentos com Cobrança Direta / À Vista (Zelle / Venmo / Check)</span>
                  <span className="font-mono font-semibold">{fmtCurrency(reportData?.dre?.grossRevenueAppointments)}</span>
                </div>

                {/* (-) Gastos Totais */}
                <div className="py-2.5 flex items-center justify-between font-bold text-slate-900 bg-slate-50/60 px-3 rounded-lg mt-2">
                  <span className="flex items-center gap-2">
                    <span className="text-rose-600">(-)</span> Gastos Totais da Operação (Custos & Despesas)
                  </span>
                  <span className="font-mono text-rose-700 text-sm">
                    {fmtCurrency(reportData?.dre?.totalExpenses)}
                  </span>
                </div>

                {/* Despesas Operacionais por Categoria */}
                <div className="py-2 pl-8 pr-3 flex items-center justify-between font-semibold text-slate-700">
                  <span>1. Despesas Operacionais em Campo</span>
                  <span className="font-mono text-rose-600">
                    {fmtCurrency(reportData?.dre?.operationalExpenses)}
                  </span>
                </div>

                {(reportData?.dre?.expensesByCategory || []).map((cat: any) => (
                  <div key={cat.label} className="py-1.5 pl-12 pr-3 flex items-center justify-between text-slate-500 text-[11px]">
                    <span>• {cat.label} ({cat.count}x)</span>
                    <span className="font-mono">{fmtCurrency(cat.amount)}</span>
                  </div>
                ))}

                {/* Comissões da Equipe por Profissional */}
                <div className="py-2 pl-8 pr-3 flex items-center justify-between font-semibold text-slate-700 pt-3">
                  <span>2. Comissões da Equipe de Limpeza</span>
                  <span className="font-mono text-amber-600">
                    {fmtCurrency(reportData?.dre?.staffCommissions)}
                  </span>
                </div>

                {(reportData?.dre?.commissionsByProfessional || []).map((prof: any) => (
                  <div key={prof.id} className="py-1.5 pl-12 pr-3 flex items-center justify-between text-slate-500 text-[11px]">
                    <span>• {prof.name} ({prof.jobCount} atendimentos)</span>
                    <span className="font-mono">{fmtCurrency(prof.totalCommission)}</span>
                  </div>
                ))}

                {/* (=) Lucro Líquido Real */}
                <div className="py-3 flex items-center justify-between font-black text-sm text-indigo-900 bg-indigo-50/80 px-4 rounded-xl mt-3 border border-indigo-100">
                  <span>(=) LUCRO LÍQUIDO REAL DA OPERAÇÃO</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-indigo-600 font-semibold">
                      Margem: {reportData?.dre?.marginPercent}%
                    </span>
                    <span className="font-mono text-base">{fmtCurrency(reportData?.dre?.netProfit)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Extrato Detalhado de Transações */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-500" />
                  Extrato Discriminado de Entradas & Saídas
                </h3>
                <span className="text-xs text-slate-400">
                  Mostrando lançamentos do período
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4">Cliente / Fornecedor</th>
                      <th className="py-3 px-4">Categoria / Equipe</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {/* 1. Atendimentos da Agenda (Receitas Operacionais) */}
                    {(reportData?.transactions?.appointments || []).map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {a.date.split("T")[0]}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            Atendimento
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-900 font-semibold">{a.description}</td>
                        <td className="py-2.5 px-4 text-slate-600">{a.clientName || "-"}</td>
                        <td className="py-2.5 px-4">
                          <div className="space-y-0.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                a.invoiced
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {a.invoiced ? `Faturado (Inv #${a.invoiceNumber || "Sim"})` : "Cobrança Direta"}
                            </span>
                            {a.professionals?.length > 0 && (
                              <p className="text-[10px] text-slate-400">
                                Equipe: {a.professionals.join(", ")}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                          +{fmtCurrency(a.grossAmount)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {(() => {
                            const paid = a.status === "PAID";
                            const overdue = isTransactionOverdue(a.date, paid);
                            return (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  paid
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : overdue
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {paid ? "Pago" : overdue ? "Atrasado" : "Pendente"}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}

                    {/* 2. Despesas Operacionais em Campo (Saídas) */}
                    {(reportData?.transactions?.expenses || []).map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {e.date.split("T")[0]}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold">
                            Despesa
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-900 font-semibold">{e.description}</td>
                        <td className="py-2.5 px-4 text-slate-400">-</td>
                        <td className="py-2.5 px-4 text-slate-500">{e.category}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                          -{fmtCurrency(e.grossAmount)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                            Liquidado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Painel Discriminado de Faturas Comerciais Emitidas (Documentos Fiscais) */}
            {(reportData?.transactions?.invoices || []).length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                      Faturas Comerciais Emitidas no Período ({reportData.transactions.invoices.length})
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      As faturas formalizam as cobranças dos atendimentos da agenda. Os valores já compõem a receita operacional acima para evitar duplicidade contábil.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-600">
                    Total Faturado: {fmtCurrency(reportData?.dre?.invoicesEmittedTotal)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Emissão</th>
                        <th className="py-3 px-4">Documento</th>
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">Forma de Cobrança</th>
                        <th className="py-3 px-4 text-right">Valor da Fatura</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {reportData.transactions.invoices.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {inv.date.split("T")[0]}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-indigo-600">
                            {inv.description}
                          </td>
                          <td className="py-2.5 px-4 text-slate-800 font-semibold">
                            {inv.clientName || "-"}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">
                            {inv.paymentMethod}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {fmtCurrency(inv.grossAmount)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.status === "PAID"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : inv.status === "OVERDUE"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {inv.status === "PAID" ? "Recebido" : inv.status === "OVERDUE" ? "Vencida" : "Pendente"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            ABA 2: RELATÓRIO OPERACIONAL DE AGENDAMENTOS
           ========================================================================= */}
        {activeTab === "appointments" && (
          <div className="space-y-6">
            {/* KPI Cards Operacionais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Total de Agendamentos</span>
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {kpis?.totalCount || 0}
                </div>
                <p className="text-[11px] text-slate-500">
                  {kpis?.completedCount || 0} concluídos • {kpis?.scheduledCount || 0} agendados
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Faturamento Previsto</span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-emerald-700 tracking-tight">
                  {fmtCurrency(kpis?.totalProjected)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Realizado: {fmtCurrency(kpis?.totalRealized)}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Comissões Estimadas</span>
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-amber-600 tracking-tight">
                  {fmtCurrency(kpis?.totalCommissions)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Para os profissionais escalados
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Ticket Médio por Faxina</span>
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-indigo-900 tracking-tight">
                  {fmtCurrency(kpis?.averageTicket)}
                </div>
                <p className="text-[11px] text-slate-500">Média no período</p>
              </div>
            </div>

            {/* Tabela Operacional de Atendimentos */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Escala de Agendamentos & Detalhamento Operacional
                </h3>
                <span className="text-xs text-slate-400">
                  {reportData?.items?.length || 0} registros encontrados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Data & Horário</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Endereço & Local</th>
                      <th className="py-3 px-4">Modalidade</th>
                      <th className="py-3 px-4">Equipe Escalada</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(reportData?.items || []).map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-slate-900 font-bold">
                            {new Date(item.date).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              timeZone: "America/Denver",
                            })}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {new Date(item.date).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "America/Denver",
                            })}
                          </div>
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {item.client?.name || item.title}
                          </div>
                          {item.client?.phone && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              {item.client.phone}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-slate-600 max-w-[200px] truncate">
                          <div>{item.address}</div>
                          <div className="text-[11px] text-slate-400">{item.city}</div>
                        </td>

                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                            {item.cleaningCategory}
                          </span>
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {item.professionals?.length > 0 ? (
                              item.professionals.map((p: any) => (
                                <span
                                  key={p.id}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold"
                                >
                                  {p.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">Não atribuído</span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {fmtCurrency(item.price)}
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : item.status === "CANCELLED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {item.status === "COMPLETED"
                              ? "Concluído"
                              : item.status === "CANCELLED"
                              ? "Cancelado"
                              : "Agendado"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé de Assinatura para Impressão */}
        <div className="hidden print:block pt-16 mt-12 border-t border-slate-300">
          <div className="grid grid-cols-2 gap-12 text-center text-xs text-slate-700">
            <div>
              <div className="border-t border-slate-400 pt-2 w-3/4 mx-auto font-bold">
                Renata Matos de Oliveira
              </div>
              <p className="text-[11px] text-slate-500">Diretora Operacional / Proprietária</p>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-2 w-3/4 mx-auto font-bold">
                Willians de Oliveira
              </div>
              <p className="text-[11px] text-slate-500">Líder de Equipe / Co-proprietário</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
