import { prisma } from "@/lib/prisma";
import { BUSINESS_TIMEZONE, zonedPartsFromUtc, zonedTimeToUtc } from "@/lib/calendar/timezone";

export interface RevenuePeriod {
  label: string;
  subLabel?: string;
  revenue: number;
  expenses: number;
  profit: number;
  prevRevenue?: number;
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * Calcula receita operacional e despesas para um intervalo de datas.
 * A Agenda Operacional (Appointment) é a fonte da verdade de faturamento da empresa.
 * As Invoices são instrumentos de cobrança dos atendimentos e NÃO devem ser somadas
 * por cima dos atendimentos para evitar qualquer duplicidade contábil.
 */
async function sumRevenueAndExpenses(
  companyId: string,
  start: Date,
  end: Date
): Promise<{ revenue: number; expenses: number }> {
  const [appointmentsAgg, expensesAgg] = await Promise.all([
    prisma.appointment.aggregate({
      where: {
        companyId,
        date: { gte: start, lte: end },
        billable: true,
        // "Faturamento" é receita realizada - só atendimentos já concluídos,
        // não o valor de agendamentos futuros ainda nem realizados.
        status: "COMPLETED",
      },
      _sum: { price: true },
    }),
    prisma.expense.aggregate({
      where: {
        companyId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
  ]);

  const revenue = Number(appointmentsAgg._sum.price || 0);
  const expenseTotal = Number(expensesAgg._sum.amount || 0);

  return { revenue, expenses: expenseTotal };
}

export class RevenueChartService {
  /**
   * Decomposição semanal do mês vigente dividida em semanas de calendário reais (Domingo a Sábado),
   * garantindo paridade de 100% com o faturamento da agenda e a meta semanal do dashboard.
   * Converte para o fuso horário de operação (America/Denver / Mountain Time).
   */
  static async getWeeklySeries(companyId: string): Promise<RevenuePeriod[]> {
    const now = new Date();
    const localNow = zonedPartsFromUtc(now, BUSINESS_TIMEZONE);
    const year = localNow.year;
    const month = localNow.month - 1; // 0-indexed
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();

    // Constrói semanas do calendário real (Domingo a Sábado) para o mês vigente
    const weeks: Array<{
      weekNumber: number;
      startDay: number;
      endDay: number;
      isCurrent: boolean;
    }> = [];

    let currentDay = 1;
    let weekIndex = 1;

    while (currentDay <= lastDayOfMonth) {
      const curDate = new Date(Date.UTC(year, month, currentDay));
      const dayOfWeek = curDate.getUTCDay(); // 0 = Domingo, 6 = Sábado
      const daysUntilSat = 6 - dayOfWeek;
      const endDay = Math.min(currentDay + daysUntilSat, lastDayOfMonth);
      const isCurrent = localNow.day >= currentDay && localNow.day <= endDay;

      weeks.push({
        weekNumber: weekIndex,
        startDay: currentDay,
        endDay,
        isCurrent,
      });

      currentDay = endDay + 1;
      weekIndex++;
    }

    const results = await Promise.all(
      weeks.map(async (w) => {
        const start = zonedTimeToUtc(year, month, w.startDay, 0, 0, 0, BUSINESS_TIMEZONE);
        const end = zonedTimeToUtc(year, month, w.endDay, 23, 59, 59, BUSINESS_TIMEZONE);

        // Comparativo com o período correspondente de dias no mês anterior
        const prevStartDay = Math.min(w.startDay, lastDayOfPrevMonth);
        const prevEndDay = Math.min(w.endDay, lastDayOfPrevMonth);
        const prevStart = zonedTimeToUtc(prevYear, prevMonth, prevStartDay, 0, 0, 0, BUSINESS_TIMEZONE);
        const prevEnd = zonedTimeToUtc(prevYear, prevMonth, prevEndDay, 23, 59, 59, BUSINESS_TIMEZONE);

        const [current, previous] = await Promise.all([
          sumRevenueAndExpenses(companyId, start, end),
          sumRevenueAndExpenses(companyId, prevStart, prevEnd),
        ]);

        return { w, current, previous };
      })
    );

    return results.map(({ w, current, previous }) => {
      const sDay = String(w.startDay).padStart(2, "0");
      const eDay = String(w.endDay).padStart(2, "0");
      const label = `Semana ${w.weekNumber}`;
      const subLabel = w.isCurrent ? `${sDay} a ${eDay} (Atual)` : `${sDay} a ${eDay}`;

      return {
        label,
        subLabel,
        revenue: current.revenue,
        expenses: current.expenses,
        profit: current.revenue - current.expenses,
        prevRevenue: previous?.revenue,
      };
    });
  }

  /**
   * Decomposição mensal dos últimos N meses (padrão 6), cada um com
   * prevRevenue = receita do mês imediatamente anterior.
   * Totalmente alinhado à fonte da verdade operacional (Appointments).
   */
  static async getMonthlySeries(companyId: string, months = 6): Promise<RevenuePeriod[]> {
    const now = new Date();
    const localNow = zonedPartsFromUtc(now, BUSINESS_TIMEZONE);
    const totalMonths = months + 1;

    const monthRanges = Array.from({ length: totalMonths }, (_, idx) => {
      const i = totalMonths - 1 - idx;
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

    const monthlyTotals = await Promise.all(
      monthRanges.map(async ({ year, month, start, end }) => {
        const { revenue, expenses } = await sumRevenueAndExpenses(companyId, start, end);
        return { revenue, expenses, year, month };
      })
    );

    const periods: RevenuePeriod[] = [];
    for (let i = 1; i < monthlyTotals.length; i++) {
      const current = monthlyTotals[i];
      const previous = monthlyTotals[i - 1];
      periods.push({
        label: `${MONTH_LABELS[current.month]}/${String(current.year).slice(-2)}`,
        subLabel: `${MONTH_NAMES[current.month]} ${current.year}`,
        revenue: current.revenue,
        expenses: current.expenses,
        profit: current.revenue - current.expenses,
        prevRevenue: previous.revenue,
      });
    }

    return periods;
  }
}
