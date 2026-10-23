"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Header } from "@/components/dashboard/header";
import { useToast } from "@/components/ui/toast";
import {
  Calendar,
  FileText,
  Users,
  Plus,
  ArrowUpRight,
  MapPin,
  Clock,
  Navigation,
} from "lucide-react";
import { DynamicRevenueChart } from "@/components/dashboard/dynamic-revenue-chart";
import { RevenueGoalChart } from "@/components/dashboard/revenue-goal-chart";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { PeriodMode } from "@/components/dashboard/period-toggle";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

function formatUpcomingDateTime(startTimeVal?: string | Date, dateVal?: string | Date): string {
  const d = new Date(startTimeVal || dateVal || Date.now());
  const now = new Date();

  // Comparações no fuso do Colorado (America/Denver)
  const apptDateLocal = d.toLocaleDateString("en-US", { timeZone: "America/Denver" });
  const todayLocal = now.toLocaleDateString("en-US", { timeZone: "America/Denver" });

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowLocal = tomorrow.toLocaleDateString("en-US", { timeZone: "America/Denver" });

  const timeStr = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Denver",
  });

  if (apptDateLocal === todayLocal) {
    return `Hoje às ${timeStr}`;
  }
  if (apptDateLocal === tomorrowLocal) {
    return `Amanhã às ${timeStr}`;
  }

  const weekday = d.toLocaleDateString("pt-BR", {
    weekday: "short",
    timeZone: "America/Denver",
  });
  const dateStr = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Denver",
  });

  return `${weekday}, ${dateStr} às ${timeStr}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isCleaner } = useCurrentUser();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodMode>("weekly");
  const hasShownPendingToast = useRef(false);
  const isInitialDashboardLoad = useRef(true);

  useEffect(() => {
    if (isCleaner) {
      router.replace("/cleaner");
    }
  }, [isCleaner, router]);

  const fetchMetrics = async () => {
    if (isCleaner) return;
    setLoading(true);
    try {
      const timestamp = Date.now();
      const [resMetrics, resAppts, resInvoices] = await Promise.all([
        fetch(`/api/v1/dashboard/metrics?t=${timestamp}`, { cache: "no-store" }),
        fetch(`/api/v1/appointments?upcoming=true&limit=5&t=${timestamp}`, { cache: "no-store" }),
        fetch(`/api/v1/invoices?limit=5&t=${timestamp}`, { cache: "no-store" }),
      ]);

      const metricsJson = resMetrics.ok ? (await resMetrics.json()).data : null;
      const apptsJson = resAppts.ok ? (await resAppts.json()).data : [];
      const invoicesJson = resInvoices.ok ? (await resInvoices.json()).data : [];

      setData({
        metrics: metricsJson,
        appointments: apptsJson || [],
        invoices: invoicesJson,
      });
    } catch (err) {
      console.error("Erro ao buscar dados do dashboard:", err);
      // Só mostra toast na carga inicial — chamadas automáticas de atualização
      // (polling a cada 60s) ficam silenciosas no console para não martelar
      // toast repetido numa rede instável.
      if (isInitialDashboardLoad.current) {
        showToast("Erro ao carregar dashboard.", "error");
      }
    } finally {
      setLoading(false);
      isInitialDashboardLoad.current = false;
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Auto-atualização periódica a cada 60s para manter os próximos atendimentos sempre em tempo real
    const timer = setInterval(() => {
      fetchMetrics();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const pending = data?.metrics?.pendingPayments;
    if (pending?.count > 0 && !hasShownPendingToast.current) {
      hasShownPendingToast.current = true;
      const amount = Number(
        pending.totalPending || pending.totalAmount || 0
      ).toLocaleString("en-US", { minimumFractionDigits: 2 });

      showToast(
        `Você possui ${pending.count} atendimento(s) concluído(s) com pagamento pendente ($${amount}).`,
        "warning",
        8000,
        {
          label: "Ver Pagamentos",
          onClick: () => router.push("/payments"),
        }
      );
    }
  }, [data?.metrics?.pendingPayments, router, showToast]);

  const activeGoal =
    period === "weekly"
      ? data?.metrics?.weeklyGoal
      : (data?.metrics?.monthlyGoal || data?.metrics?.goal);
  const financial = data?.metrics?.financial;
  const pendingPayments = data?.metrics?.pendingPayments;

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Header
        title="Visão Geral & Métricas"
        subtitle="Acompanhamento diário da meta de faturamento e agenda"
        onRefresh={fetchMetrics}
        loading={loading}
        showPeriodToggle={true}
        period={period}
        onPeriodChange={setPeriod}
      />

      <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Seção de Boas-vindas inspirada na referência */}
        <WelcomeBanner />

        {/* Gráfico Dinâmico da Meta de Faturamento (Semanal ou Mensal) */}
        <RevenueGoalChart goal={activeGoal} period={period} />

        {/* Gráfico Dinâmico Comparativo de Semanas & Meses (Sincronizado com o seletor do header) */}
        <DynamicRevenueChart period={period} />

        {/* Duas Colunas: Próximos Atendimentos & Faturas Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Próximos Atendimentos da Agenda */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
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
                  <div
                    key={appt.id}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">
                        {appt.client?.name && !appt.title.toLowerCase().includes(appt.client.name.toLowerCase())
                          ? `${appt.title} • ${appt.client.name}`
                          : appt.title || appt.client?.name || "Atendimento"}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
                          <Clock className="w-3 h-3 text-indigo-600" />
                          <span>{formatUpcomingDateTime(appt.startTime, appt.date)}</span>
                        </span>
                        {appt.location && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span className="truncate max-w-[150px] text-[10px]">{appt.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="font-black text-emerald-600 text-sm">
                        ${Number(appt.price).toFixed(2)}
                      </span>
                      {appt.location && (
                        <a
                          href={`https://maps.apple.com/?daddr=${encodeURIComponent(appt.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 shadow-2xs transition-colors"
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
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
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
                        <span className="text-xs font-bold text-indigo-600">{inv.invoiceNumber}</span>
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
