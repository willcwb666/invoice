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
  const [invoices, directAppointments, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        companyId,
        issueDate: { gte: start, lte: end },
        // DRAFT invoices haven't been issued to the client yet and CANCELLED
        // ones never will be - neither counts as real billed revenue.
        status: { notIn: ["DRAFT", "CANCELLED"] },
      },
      select: { totalAmount: true },
    }),
    // A maioria dos clientes nunca recebe uma Invoice - eles pagam direto
    // pela limpeza (ver PaymentService). invoiced=false evita somar de novo
    // um atendimento que já virou item de uma fatura (contado acima).
    prisma.appointment.findMany({
      where: {
        companyId,
        date: { gte: start, lte: end },
        billable: true,
        status: "COMPLETED",
        invoiced: false,
      },
      select: { price: true },
    }),
    prisma.expense.findMany({
      where: { companyId, date: { gte: start, lte: end } },
      select: { amount: true },
    }),
  ]);

  const revenue =
    invoices.reduce((acc, inv) => acc + Number(inv.totalAmount), 0) +
    directAppointments.reduce((acc, appt) => acc + Number(appt.price), 0);
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

    // Buckets are independent of each other - compute every range up front
    // and fire all the current+previous lookups together, instead of
    // awaiting one bucket's pair before starting the next bucket's.
    const applicableBuckets = WEEK_BUCKETS.filter((b) => b.startDay <= lastDayOfMonth);

    const results = await Promise.all(
      applicableBuckets.map(async (bucket) => {
        const endDay = bucket.endDay ?? lastDayOfMonth;
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

        return { bucket, current, previous };
      })
    );

    return results.map(({ bucket, current, previous }, idx) => ({
      label: `Semana ${idx + 1}`,
      subLabel: bucket.label,
      revenue: current.revenue,
      expenses: current.expenses,
      profit: current.revenue - current.expenses,
      prevRevenue: previous?.revenue,
    }));
  }

  /**
   * Monthly breakdown of the last N months (default 6), each with
   * prevRevenue = the immediately preceding month's revenue.
   */
  static async getMonthlySeries(companyId: string, months = 6): Promise<RevenuePeriod[]> {
    const now = new Date();
    // Fetch one extra month so the oldest displayed month has a real prevRevenue.
    const totalMonths = months + 1;

    // Each month's range is independent of every other's, so there's no
    // reason to await them one at a time - that just serializes N round
    // trips to the database for no benefit.
    const monthRanges = Array.from({ length: totalMonths }, (_, idx) => {
      const i = totalMonths - 1 - idx;
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      return {
        year,
        month,
        start: new Date(year, month, 1, 0, 0, 0),
        end: new Date(year, month + 1, 0, 23, 59, 59),
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
