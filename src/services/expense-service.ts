import { prisma } from "@/lib/prisma";
import { CreateExpenseInput } from "@/lib/validations/expense";
import { Prisma } from "@prisma/client";

export class ExpenseService {
  /**
   * Lista despesas cadastradas
   */
  static async listExpenses(
    companyId: string,
    options?: {
      category?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const { category, startDate, endDate } = options || {};
    const dateFilter =
      startDate || endDate
        ? {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          }
        : undefined;

    return prisma.expense.findMany({
      where: {
        companyId,
        ...(category && category !== "ALL" ? { category: category as any } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      orderBy: { date: "desc" },
    });
  }

  /**
   * Registra uma nova despesa
   */
  static async createExpense(companyId: string, data: CreateExpenseInput) {
    return prisma.expense.create({
      data: {
        companyId,
        category: data.category,
        description: data.description,
        amount: new Prisma.Decimal(data.amount),
        date: data.date ? new Date(data.date) : new Date(),
        recurrence: data.recurrence || "ONE_TIME",
        notes: data.notes || null,
      },
    });
  }

  /**
   * Resumo Financeiro Completo: Faturamento, Despesas e Lucro Líquido Real
   */
  static async getFinancialSummary(companyId: string, startDate?: Date, endDate?: Date) {
    const dateFilter = startDate || endDate
      ? {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        }
      : undefined;

    // Grouped/aggregated in the database - one row per status/per
    // paid/per category instead of one row per invoice/appointment/expense
    // pulled over the wire just to be summed in JS.
    const [invoiceStatusTotals, apptPaidTotals, categoryTotals] = await Promise.all([
      prisma.invoice.groupBy({
        by: ["status"],
        where: {
          companyId,
          ...(dateFilter ? { issueDate: dateFilter } : {}),
        },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      // A maioria dos clientes nunca recebe uma Invoice - eles pagam direto
      // pela limpeza (ver PaymentService). invoiced=false evita somar de novo
      // um atendimento que já virou item de uma fatura (contado acima).
      prisma.appointment.groupBy({
        by: ["paid"],
        where: {
          companyId,
          ...(dateFilter ? { date: dateFilter } : {}),
          billable: true,
          status: "COMPLETED",
          invoiced: false,
        },
        _sum: { price: true },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: {
          companyId,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        _sum: { amount: true },
      }),
    ]);

    let totalBilled = 0;
    let totalReceived = 0;
    let totalPending = 0;

    for (const row of invoiceStatusTotals) {
      const total = Number(row._sum.totalAmount || 0);
      const paid = Number(row._sum.paidAmount || 0);
      if (row.status !== "CANCELLED" && row.status !== "DRAFT") {
        totalBilled += total;
      }
      if (row.status === "PAID") {
        totalReceived += total;
      } else if (row.status === "PENDING" || row.status === "OVERDUE") {
        totalPending += total - paid;
      }
    }

    for (const row of apptPaidTotals) {
      const price = Number(row._sum.price || 0);
      totalBilled += price;
      if (row.paid) {
        totalReceived += price;
      } else {
        totalPending += price;
      }
    }

    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};

    for (const row of categoryTotals) {
      const amt = Number(row._sum.amount || 0);
      totalExpenses += amt;
      expensesByCategory[row.category] = amt;
    }

    const netProfit = totalReceived - totalExpenses;

    return {
      totalBilled,
      totalReceived,
      totalPending,
      totalExpenses,
      netProfit,
      expensesByCategory,
    };
  }
}
