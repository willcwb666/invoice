import { prisma } from "@/lib/prisma";

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

// Fixed day-of-month buckets, matching a typical 4-week billing cadence.
const WEEK_BUCKETS: Array<{ startDay: number; endDay: number | null; label: string }> = [
  { startDay: 1, endDay: 7, label: "01 a 07" },
  { startDay: 8, endDay: 14, label: "08 a 14" },
  { startDay: 15, endDay: 21, label: "15 a 21" },
  { startDay: 22, endDay: null, label: "22 a fim" }, // null = last day of month
];

async function sumRevenueAndExpenses(
  companyId: string,
  start: Date,
  end: Date
): Promise<{ revenue: number; expenses: number }> {
  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        companyId,
        issueDate: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
      select: { totalAmount: true },
    }),
    prisma.expense.findMany({
      where: { companyId, date: { gte: start, lte: end } },
      select: { amount: true },
    }),
  ]);

  const revenue = invoices.reduce((acc, inv) => acc + Number(inv.totalAmount), 0);
  const expenseTotal = expenses.reduce((acc, exp) => acc + Number(exp.amount), 0);

  return { revenue, expenses: expenseTotal };
}

export class RevenueChartService {
  /**
   * Weekly breakdown of the current month (fixed 1-7/8-14/15-21/22-end
   * buckets), each with prevRevenue = the same day-range in the prior month.
   */
  static async getWeeklySeries(companyId: string): Promise<RevenuePeriod[]> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDate = new Date(year, month - 1, 1);
    const lastDayOfPrevMonth = new Date(
      prevMonthDate.getFullYear(),
      prevMonthDate.getMonth() + 1,
      0
    ).getDate();

    const periods: RevenuePeriod[] = [];

    for (const bucket of WEEK_BUCKETS) {
      const endDay = bucket.endDay ?? lastDayOfMonth;
      if (bucket.startDay > lastDayOfMonth) break; // month has no such range (rare edge case)

      const start = new Date(year, month, bucket.startDay, 0, 0, 0);
      const end = new Date(year, month, Math.min(endDay, lastDayOfMonth), 23, 59, 59);

      const prevEndDay = bucket.endDay ?? lastDayOfPrevMonth;
      const prevStart = new Date(
        prevMonthDate.getFullYear(),
        prevMonthDate.getMonth(),
        bucket.startDay,
        0, 0, 0
      );
      const prevEnd = new Date(
        prevMonthDate.getFullYear(),
        prevMonthDate.getMonth(),
        Math.min(prevEndDay, lastDayOfPrevMonth),
        23, 59, 59
      );

      const [current, previous] = await Promise.all([
        sumRevenueAndExpenses(companyId, start, end),
        bucket.startDay <= lastDayOfPrevMonth
          ? sumRevenueAndExpenses(companyId, prevStart, prevEnd)
          : Promise.resolve(null),
      ]);

      periods.push({
        label: `Semana ${periods.length + 1}`,
        subLabel: bucket.label,
        revenue: current.revenue,
        expenses: current.expenses,
        profit: current.revenue - current.expenses,
        prevRevenue: previous?.revenue,
      });
    }

    return periods;
  }

  /**
   * Monthly breakdown of the last N months (default 6), each with
   * prevRevenue = the immediately preceding month's revenue.
   */
  static async getMonthlySeries(companyId: string, months = 6): Promise<RevenuePeriod[]> {
    const now = new Date();
    // Fetch one extra month so the oldest displayed month has a real prevRevenue.
    const totalMonths = months + 1;
    const monthlyTotals: { revenue: number; expenses: number; year: number; month: number }[] = [];

    for (let i = totalMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const start = new Date(year, month, 1, 0, 0, 0);
      const end = new Date(year, month + 1, 0, 23, 59, 59);

      const { revenue, expenses } = await sumRevenueAndExpenses(companyId, start, end);
      monthlyTotals.push({ revenue, expenses, year, month });
    }

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
