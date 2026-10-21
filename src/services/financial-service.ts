import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type FinancialPeriod = "month" | "last_month" | "quarter" | "year" | "all";

export interface FinancialFilterOptions {
  period?: FinancialPeriod;
  startDate?: Date;
  endDate?: Date;
}

export interface MetricWithGrowth {
  value: number;
  prevValue: number;
  growthPercent: number | null;
  isPositive: boolean;
}

export interface ExpenseCategorySummary {
  category: string;
  label: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface TopClientSummary {
  id: string;
  name: string;
  billingType: string;
  totalPaid: number;
  totalPending: number;
  cleaningsCount: number;
  percentOfTotal: number;
}

export interface CashFlowMonth {
  label: string;
  subLabel: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

export interface FinancialTransaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  date: string;
  description: string;
  clientName?: string;
  category: string;
  amount: number;
  paymentMethod?: string;
  status?: string;
}

const BUSINESS_TIMEZONE = "America/Denver";

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const findVal = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: findVal("year"),
    month: findVal("month"),
    day: findVal("day"),
  };
}

function zonedTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, monthIndex, day, hour, minute, second));
  const invDate = new Date(
    utcGuess.toLocaleString("en-US", { timeZone: "UTC" })
  );
  const targetDate = new Date(
    utcGuess.toLocaleString("en-US", { timeZone })
  );
  const diff = targetDate.getTime() - invDate.getTime();
  return new Date(utcGuess.getTime() - diff);
}

const CATEGORY_NAMES: Record<string, string> = {
  FUEL: "Combustível / Gasolina",
  CLEANING_SUPPLIES: "Produtos de Limpeza",
  VEHICLE_MAINTENANCE: "Manutenção Veicular",
  EQUIPMENT: "Equipamentos / Máquinas",
  MEALS: "Alimentação em Campo",
  OTHER: "Outras Despesas",
};

export class FinancialService {
  /**
   * Resolve o intervalo de datas para o período selecionado e para o período anterior de comparação
   */
  static getDateRanges(options: FinancialFilterOptions = {}) {
    const period = options.period || "month";
    const now = new Date();
    const localNow = getZonedDateParts(now, BUSINESS_TIMEZONE);

    let startDate: Date;
    let endDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;
    let periodLabel = "Mês Vigente";

    if (options.startDate && options.endDate) {
      startDate = options.startDate;
      endDate = options.endDate;
      const duration = endDate.getTime() - startDate.getTime();
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(prevEndDate.getTime() - duration);
      periodLabel = "Período Personalizado";
    } else if (period === "last_month") {
      const prevMonth = localNow.month === 1 ? 12 : localNow.month - 1;
      const prevYear = localNow.month === 1 ? localNow.year - 1 : localNow.year;
      startDate = zonedTimeToUtc(prevYear, prevMonth - 1, 1, 0, 0, 0, BUSINESS_TIMEZONE);
      const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
      endDate = zonedTimeToUtc(prevYear, prevMonth - 1, lastDayOfPrevMonth, 23, 59, 59, BUSINESS_TIMEZONE);

      // Mês anterior ao mês anterior
      const beforePrevMonth = prevMonth === 1 ? 12 : prevMonth - 1;
      const beforePrevYear = prevMonth === 1 ? prevYear - 1 : prevYear;
      prevStartDate = zonedTimeToUtc(beforePrevYear, beforePrevMonth - 1, 1, 0, 0, 0, BUSINESS_TIMEZONE);
      const lastDayBeforePrev = new Date(Date.UTC(beforePrevYear, beforePrevMonth, 0)).getUTCDate();
      prevEndDate = zonedTimeToUtc(beforePrevYear, beforePrevMonth - 1, lastDayBeforePrev, 23, 59, 59, BUSINESS_TIMEZONE);
      periodLabel = "Mês Anterior";
    } else if (period === "quarter") {
      // Últimos 3 meses
      const startQuarterMonth = localNow.month - 2 <= 0 ? localNow.month + 10 : localNow.month - 2;
      const startQuarterYear = localNow.month - 2 <= 0 ? localNow.year - 1 : localNow.year;
      startDate = zonedTimeToUtc(startQuarterYear, startQuarterMonth - 1, 1, 0, 0, 0, BUSINESS_TIMEZONE);
      const lastDayOfCurrentMonth = new Date(Date.UTC(localNow.year, localNow.month, 0)).getUTCDate();
      endDate = zonedTimeToUtc(localNow.year, localNow.month - 1, lastDayOfCurrentMonth, 23, 59, 59, BUSINESS_TIMEZONE);

      // Trimestre anterior
      const duration = endDate.getTime() - startDate.getTime();
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(prevEndDate.getTime() - duration);
      periodLabel = "Últimos 3 Meses";
    } else if (period === "year") {
      startDate = zonedTimeToUtc(localNow.year, 0, 1, 0, 0, 0, BUSINESS_TIMEZONE);
      endDate = zonedTimeToUtc(localNow.year, 11, 31, 23, 59, 59, BUSINESS_TIMEZONE);

      prevStartDate = zonedTimeToUtc(localNow.year - 1, 0, 1, 0, 0, 0, BUSINESS_TIMEZONE);
      prevEndDate = zonedTimeToUtc(localNow.year - 1, 11, 31, 23, 59, 59, BUSINESS_TIMEZONE);
      periodLabel = `Ano ${localNow.year}`;
    } else if (period === "all") {
      startDate = new Date(2023, 0, 1);
      endDate = new Date(localNow.year + 1, 11, 31);
      prevStartDate = new Date(2022, 0, 1);
      prevEndDate = new Date(2022, 11, 31);
      periodLabel = "Todo o Histórico";
    } else {
      // "month" (Default: Mês corrente)
      startDate = zonedTimeToUtc(localNow.year, localNow.month - 1, 1, 0, 0, 0, BUSINESS_TIMEZONE);
      const lastDayOfMonth = new Date(Date.UTC(localNow.year, localNow.month, 0)).getUTCDate();
      endDate = zonedTimeToUtc(localNow.year, localNow.month - 1, lastDayOfMonth, 23, 59, 59, BUSINESS_TIMEZONE);

      const prevMonth = localNow.month === 1 ? 12 : localNow.month - 1;
      const prevYear = localNow.month === 1 ? localNow.year - 1 : localNow.year;
      prevStartDate = zonedTimeToUtc(prevYear, prevMonth - 1, 1, 0, 0, 0, BUSINESS_TIMEZONE);
      const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
      prevEndDate = zonedTimeToUtc(prevYear, prevMonth - 1, lastDayOfPrevMonth, 23, 59, 59, BUSINESS_TIMEZONE);
      periodLabel = "Mês Vigente";
    }

    return { startDate, endDate, prevStartDate, prevEndDate, periodLabel, period };
  }

  /**
   * Carrega todos os dados do dashboard financeiro completo.
   * A Agenda Operacional é a fonte da verdade para todo o faturamento da empresa.
   * Não soma Invoices com Atendimentos para eliminar 100% de duplicidades contábeis.
   */
  static async getFinancialDashboard(companyId: string, options: FinancialFilterOptions = {}) {
    const { startDate, endDate, prevStartDate, prevEndDate, periodLabel, period } =
      this.getDateRanges(options);

    // 1. Consultas para o Período Selecionado
    const [
      appointments,
      expenses,
      prevAppointments,
      prevExpenses,
      recentExpenses,
      recentPaidAppointments,
    ] = await Promise.all([
      // Todos os atendimentos da agenda no período (sem cancelados)
      prisma.appointment.findMany({
        where: {
          companyId,
          date: { gte: startDate, lte: endDate },
          billable: true,
          status: { not: "CANCELLED" },
        },
        include: {
          client: { select: { id: true, name: true, billingType: true } },
          invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, dueDate: true } },
        },
        orderBy: { date: "desc" },
      }),
      // Despesas do período
      prisma.expense.findMany({
        where: {
          companyId,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: "desc" },
      }),
      // Atendimentos do período anterior
      prisma.appointment.findMany({
        where: {
          companyId,
          date: { gte: prevStartDate, lte: prevEndDate },
          billable: true,
          status: { not: "CANCELLED" },
        },
        include: {
          invoice: { select: { status: true } },
        },
      }),
      // Despesas do período anterior
      prisma.expense.findMany({
        where: {
          companyId,
          date: { gte: prevStartDate, lte: prevEndDate },
        },
        select: { amount: true },
      }),
      // Despesas recentes para o extrato
      prisma.expense.findMany({
        where: {
          companyId,
          ...(period !== "all" ? { date: { gte: startDate, lte: endDate } } : {}),
        },
        orderBy: { date: "desc" },
        take: 15,
      }),
      // Atendimentos recentes pagos para o extrato
      prisma.appointment.findMany({
        where: {
          companyId,
          billable: true,
          status: { not: "CANCELLED" },
          OR: [{ paid: true }, { invoice: { status: "PAID" } }],
          ...(period !== "all" ? { date: { gte: startDate, lte: endDate } } : {}),
        },
        orderBy: { date: "desc" },
        take: 15,
        include: { client: { select: { name: true } } },
      }),
    ]);

    // 2. Cálculos do Período Atual
    // "Faturamento", "Pendente/A Receber", DRE e Top Clientes são receita
    // REALIZADA - só contam atendimentos já concluídos (status COMPLETED).
    // Um agendamento futuro ainda não é faturamento só porque está marcado
    // billable=true; isso é o que "Total Previsto na Agenda" (agendaTotal,
    // abaixo) já representa corretamente. Sem esse filtro, "Faturamento
    // Bruto Total" e "Total Previsto na Agenda" acabavam mostrando
    // exatamente o mesmo número (agendamentos futuros inflando a receita
    // "realizada" antes do serviço ser prestado).
    const completedAppointments = appointments.filter((a) => a.status === "COMPLETED");

    let grossRevenue = 0;
    let revenueFromInvoices = 0;
    let revenueDirect = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let overdueAmount = 0;

    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    for (const appt of completedAppointments) {
      const price = Number(appt.price || 0);
      grossRevenue += price;

      const hasInvoice = Boolean(appt.invoiced || appt.invoiceId || appt.invoice);
      if (hasInvoice) {
        revenueFromInvoices += price;
      } else {
        revenueDirect += price;
      }

      const isPaid = Boolean(appt.paid || appt.invoice?.status === "PAID");
      if (isPaid) {
        totalReceived += price;
      } else {
        totalPending += price;
        const isPastDue =
          new Date(appt.date) < yesterday ||
          (appt.invoice?.dueDate && new Date(appt.invoice.dueDate) < now);
        if (isPastDue) {
          overdueAmount += price;
        }
      }
    }

    let totalExpenses = 0;
    const expensesMap: Record<string, { amount: number; count: number }> = {};

    for (const exp of expenses) {
      const amt = Number(exp.amount || 0);
      totalExpenses += amt;
      if (!expensesMap[exp.category]) {
        expensesMap[exp.category] = { amount: 0, count: 0 };
      }
      expensesMap[exp.category].amount += amt;
      expensesMap[exp.category].count += 1;
    }

    const netProfit = totalReceived - totalExpenses;
    const profitMargin = totalReceived > 0 ? (netProfit / totalReceived) * 100 : 0;
    const cleaningsCount = completedAppointments.length;
    const averageTicket = cleaningsCount > 0 ? grossRevenue / cleaningsCount : 0;
    // Previsto na Agenda é o valor de TODOS os agendamentos do período
    // (concluídos + ainda agendados) - propositalmente inclui trabalho
    // futuro, diferente de grossRevenue acima (só realizado).
    const totalAgenda = appointments.reduce((acc, a) => acc + Number(a.price || 0), 0);
    const totalAgendaCount = appointments.length;

    // 3. Cálculos do Período Anterior
    let prevGrossRevenue = 0;
    let prevTotalReceived = 0;

    for (const appt of prevAppointments.filter((a) => a.status === "COMPLETED")) {
      const price = Number(appt.price || 0);
      prevGrossRevenue += price;
      const isPaid = Boolean(appt.paid || appt.invoice?.status === "PAID");
      if (isPaid) {
        prevTotalReceived += price;
      }
    }

    const prevTotalExpenses = prevExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const prevNetProfit = prevTotalReceived - prevTotalExpenses;

    const calcGrowth = (curr: number, prev: number): number | null => {
      if (prev <= 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    const growthRevenue = calcGrowth(grossRevenue, prevGrossRevenue);
    const growthReceived = calcGrowth(totalReceived, prevTotalReceived);
    const growthExpenses = calcGrowth(totalExpenses, prevTotalExpenses);
    const growthProfit = calcGrowth(netProfit, prevNetProfit);

    // 4. DRE Gerencial
    const dreExpensesByCategory: ExpenseCategorySummary[] = Object.keys(expensesMap).map((cat) => {
      const item = expensesMap[cat];
      return {
        category: cat,
        label: CATEGORY_NAMES[cat] || cat,
        amount: item.amount,
        percentage: totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0,
        count: item.count,
      };
    }).sort((a, b) => b.amount - a.amount);

    const dre = {
      grossRevenueCleanings: revenueDirect,
      grossRevenueInvoices: revenueFromInvoices,
      grossRevenueTotal: grossRevenue,
      discounts: 0,
      netRevenue: grossRevenue,
      operatingExpenses: totalExpenses,
      operatingProfit: grossRevenue - totalExpenses,
      netProfit,
      operatingMarginPercent: grossRevenue > 0 ? ((grossRevenue - totalExpenses) / grossRevenue) * 100 : 0,
      netMarginPercent: profitMargin,
      expensesByCategory: dreExpensesByCategory,
    };

    // 5. Top Clientes por Receita da Operação
    const clientAgg: Record<
      string,
      { id: string; name: string; billingType: string; totalPaid: number; totalPending: number; count: number }
    > = {};

    for (const appt of completedAppointments) {
      const c = appt.client;
      if (!c) continue;
      if (!clientAgg[c.id]) {
        clientAgg[c.id] = {
          id: c.id,
          name: c.name,
          billingType: c.billingType || (appt.invoice ? "INVOICE" : "PER_CLEANING"),
          totalPaid: 0,
          totalPending: 0,
          count: 0,
        };
      }
      const price = Number(appt.price || 0);
      const isPaid = Boolean(appt.paid || appt.invoice?.status === "PAID");
      if (isPaid) {
        clientAgg[c.id].totalPaid += price;
      } else {
        clientAgg[c.id].totalPending += price;
      }
      clientAgg[c.id].count += 1;
    }

    const topClients: TopClientSummary[] = Object.values(clientAgg)
      .map((c) => ({
        id: c.id,
        name: c.name,
        billingType: c.billingType,
        totalPaid: c.totalPaid,
        totalPending: c.totalPending,
        cleaningsCount: c.count,
        percentOfTotal: grossRevenue > 0 ? ((c.totalPaid + c.totalPending) / grossRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.totalPaid + b.totalPending - (a.totalPaid + a.totalPending))
      .slice(0, 8);

    // 6. Evolução Mensal do Fluxo de Caixa (últimos 6 meses)
    const cashFlowSeries = await this.getCashFlowSeries(companyId, 6);

    // 7. Extrato Consolidado das Últimas Transações
    const transactions: FinancialTransaction[] = [
      ...recentPaidAppointments.map((a) => ({
        id: `appt-${a.id}`,
        type: "INCOME" as const,
        date: a.date.toISOString(),
        description: a.title || `Limpeza: ${a.client?.name || "Cliente"}`,
        clientName: a.client?.name,
        category: "Atendimento de Limpeza",
        amount: Number(a.price || 0),
        paymentMethod: a.paymentMethod || "Zelle / Venmo",
        status: "Recebido",
      })),
      ...recentExpenses.map((e) => ({
        id: `exp-${e.id}`,
        type: "EXPENSE" as const,
        date: e.date.toISOString(),
        description: e.description,
        category: CATEGORY_NAMES[e.category] || e.category,
        amount: Number(e.amount || 0),
        paymentMethod: e.recurrence === "ONE_TIME" ? "Avulso" : `Recorrente (${e.recurrence})`,
        status: "Pago",
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);

    return {
      period,
      periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      kpis: {
        grossRevenue: {
          value: grossRevenue,
          prevValue: prevGrossRevenue,
          growthPercent: growthRevenue,
          isPositive: (growthRevenue ?? 0) >= 0,
        },
        totalReceived: {
          value: totalReceived,
          prevValue: prevTotalReceived,
          growthPercent: growthReceived,
          isPositive: (growthReceived ?? 0) >= 0,
        },
        totalPending: {
          value: totalPending,
          overdueAmount,
        },
        totalExpenses: {
          value: totalExpenses,
          prevValue: prevTotalExpenses,
          growthPercent: growthExpenses,
          isPositive: (growthExpenses ?? 0) <= 0, // Despesa diminuindo é positivo
        },
        netProfit: {
          value: netProfit,
          prevValue: prevNetProfit,
          growthPercent: growthProfit,
          isPositive: netProfit >= 0,
        },
        profitMargin: {
          value: profitMargin,
          isHealthy: profitMargin >= 30,
        },
        averageTicket: {
          value: averageTicket,
          cleaningsCount,
        },
        agendaTotal: {
          value: totalAgenda,
          count: totalAgendaCount,
        },
      },
      dre,
      topClients,
      cashFlowSeries,
      expensesByCategory: dreExpensesByCategory,
      transactions,
    };
  }

  /**
   * Série histórica mensal do Fluxo de Caixa (Receita vs Despesa vs Lucro).
   * Alinhada com a fonte da verdade da operação (Appointments).
   */
  static async getCashFlowSeries(companyId: string, months = 6): Promise<CashFlowMonth[]> {
    const MONTH_LABELS = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];
    const MONTH_NAMES = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];

    const now = new Date();
    const localNow = getZonedDateParts(now, BUSINESS_TIMEZONE);

    const monthRanges = Array.from({ length: months }, (_, idx) => {
      const i = months - 1 - idx;
      let targetMonth = localNow.month - 1 - i;
      let targetYear = localNow.year;
      while (targetMonth < 0) {
        targetMonth += 12;
        targetYear -= 1;
      }
      const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      return {
        year: targetYear,
        month: targetMonth,
        start: zonedTimeToUtc(targetYear, targetMonth, 1, 0, 0, 0, BUSINESS_TIMEZONE),
        end: zonedTimeToUtc(targetYear, targetMonth, lastDayOfTargetMonth, 23, 59, 59, BUSINESS_TIMEZONE),
      };
    });

    const series = await Promise.all(
      monthRanges.map(async ({ year, month, start, end }) => {
        const [apptsAgg, expensesAgg] = await Promise.all([
          prisma.appointment.aggregate({
            where: {
              companyId,
              date: { gte: start, lte: end },
              billable: true,
              status: "COMPLETED",
            },
            _sum: { price: true },
          }),
          prisma.expense.aggregate({
            where: { companyId, date: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
        ]);

        const revenue = Number(apptsAgg._sum.price || 0);
        const expenseTotal = Number(expensesAgg._sum.amount || 0);
        const profit = revenue - expenseTotal;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        return {
          label: `${MONTH_LABELS[month]}/${String(year).slice(-2)}`,
          subLabel: `${MONTH_NAMES[month]} ${year}`,
          revenue,
          expenses: expenseTotal,
          profit,
          margin: Number(margin.toFixed(1)),
        };
      })
    );

    return series;
  }
}
