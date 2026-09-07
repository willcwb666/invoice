"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Header } from "@/components/dashboard/header";
import {
  DollarSign,
  AlertCircle,
  Fuel,
  TrendingUp,
  Flame,
  Calendar,
  FileText,
  Users,
  Plus,
  ArrowUpRight,
  MapPin,
  Clock,
  Navigation,
} from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const [resMetrics, resAppts, resInvoices] = await Promise.all([
        fetch("/api/v1/dashboard/metrics"),
        fetch("/api/v1/appointments"),
        fetch("/api/v1/invoices"),
      ]);

      const metricsJson = resMetrics.ok ? (await resMetrics.json()).data : null;
      const apptsJson = resAppts.ok ? (await resAppts.json()).data : [];
      const invoicesJson = resInvoices.ok ? (await resInvoices.json()).data : [];

      setData({
        metrics: metricsJson,
        appointments: apptsJson.slice(0, 4),
        invoices: invoicesJson.slice(0, 5),
      });
    } catch (err) {
      console.error("Erro ao buscar dados do dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const goal = data?.metrics?.goal;
  const financial = data?.metrics?.financial;

  return (
    <div>
      <Header
        title="Visão Geral & Métricas"
        subtitle="Acompanhamento diário da meta de faturamento e agenda"
        onRefresh={fetchMetrics}
        loading={loading}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Banner de Meta Mensal ($6,000) e Projeção com a Agenda */}
        {goal && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/70 border border-indigo-100 shadow-sm relative overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                    <Flame className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Meta de Faturamento Mensal
                  </span>
                </div>
                <h2 className="text-3xl font-black text-slate-900">
                  ${goal.currentBilled.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                  <span className="text-sm font-semibold text-slate-500">
                    de ${goal.monthlyGoal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </h2>
                <p className="text-xs text-slate-600">
                  {goal.isGoalReached ? (
                    <span className="text-emerald-700 font-bold">🎉 Meta mensal atingida com sucesso!</span>
                  ) : (
                    <span>
                      Faltam apenas{" "}
                      <strong className="text-amber-700 font-bold">
                        ${goal.remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </strong>{" "}
                      para bater a meta de faturamento.
                    </span>
                  )}
                </p>
              </div>

              {/* Projeção futura com base na Agenda */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs min-w-[280px] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-600 font-medium">Previsão com a Agenda:</span>
                  <span className="font-bold text-emerald-700">
                    ${goal.totalProjected.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${goal.progressPercent}%` }}
                    transition={{ duration: 1 }}
                    className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-2.5 rounded-full"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-medium">
                  <span>Atingido: {goal.progressPercent}%</span>
                  <span>Previsto: {goal.projectedProgressPercent}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              title: "Recebido (Pago)",
              value: `$${(financial?.totalReceived || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              icon: DollarSign,
              color: "text-emerald-600",
              bgColor: "bg-emerald-50 border border-emerald-100",
            },
            {
              title: "Pendente / A Receber",
              value: `$${(financial?.totalPending || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              icon: AlertCircle,
              color: "text-amber-600",
              bgColor: "bg-amber-50 border border-amber-100",
            },
            {
              title: "Despesas Operacionais",
              value: `$${(financial?.totalExpenses || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              icon: Fuel,
              color: "text-rose-600",
              bgColor: "bg-rose-50 border border-rose-100",
            },
            {
              title: "Lucro Líquido Real",
              value: `$${(financial?.netProfit || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              icon: TrendingUp,
              color: "text-indigo-600",
              bgColor: "bg-indigo-50 border border-indigo-100",
            },
          ].map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.08 }}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.title}</span>
                <div className={`p-2 rounded-xl ${item.bgColor}`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">{item.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Duas Colunas: Próximos Atendimentos & Faturas Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Próximos Atendimentos da Agenda */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Próximos Atendimentos (Agenda)</h3>
              </div>
              <Link href="/agenda" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                <span>Ver todos</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {data?.appointments?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">Nenhum atendimento agendado.</p>
            ) : (
              <div className="space-y-3">
                {data?.appointments?.map((appt: any) => (
                  <div key={appt.id} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/70 transition-colors">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{appt.title} • {appt.client?.name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(appt.date).toLocaleDateString("pt-BR")}</span>
                        {appt.location && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <MapPin className="w-3 h-3 text-rose-500" />
                            <span className="truncate max-w-[150px]">{appt.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="font-black text-emerald-600 text-sm">${Number(appt.price).toFixed(2)}</span>
                      {appt.location && (
                        <a
                          href={`https://maps.apple.com/?daddr=${encodeURIComponent(appt.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 shadow-2xs"
                          title="Abrir rota no Maps"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Faturas Recentes */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Faturas Recentes</h3>
              </div>
              <Link href="/invoices" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                <span>Ver todas</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {data?.invoices?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">Nenhuma fatura emitida.</p>
            ) : (
              <div className="space-y-3">
                {data?.invoices?.map((inv: any) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-600">{inv.invoiceNumber}</span>
                        <span className="font-semibold text-slate-900 text-xs">{inv.client?.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Vencimento: {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 text-sm block">
                        ${Number(inv.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          inv.status === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
