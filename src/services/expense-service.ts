import { prisma } from "@/lib/prisma";
import { CreateExpenseInput } from "@/lib/validations/expense";
import { Prisma } from "@prisma/client";

export class ExpenseService {
  /**
   * Lista despesas cadastradas
   */
  static async listExpenses(companyId: string, category?: string) {
    return prisma.expense.findMany({
      where: {
        companyId,
        ...(category ? { category: category as any } : {}),
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

    const [invoices, directAppointments, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          companyId,
          ...(dateFilter ? { issueDate: dateFilter } : {}),
        },
        select: { status: true, totalAmount: true, paidAmount: true },
      }),
      // A maioria dos clientes nunca recebe uma Invoice - eles pagam direto
      // pela limpeza (ver PaymentService). invoiced=false evita somar de novo
      // um atendimento que já virou item de uma fatura (contado acima).
      prisma.appointment.findMany({
        where: {
          companyId,
          ...(dateFilter ? { date: dateFilter } : {}),
          billable: true,
          status: "COMPLETED",
          invoiced: false,
        },
        select: { price: true, paid: true },
      }),
      prisma.expense.findMany({
        where: {
          companyId,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        select: { category: true, amount: true },
      }),
    ]);

    let totalBilled = 0;
    let totalReceived = 0;
    let totalPending = 0;

    for (const inv of invoices) {
      const total = Number(inv.totalAmount);
      const paid = Number(inv.paidAmount);
      if (inv.status !== "CANCELLED") {
        totalBilled += total;
      }
      if (inv.status === "PAID") {
        totalReceived += total;
      } else if (inv.status === "PENDING" || inv.status === "OVERDUE") {
        totalPending += total - paid;
      }
    }

    for (const appt of directAppointments) {
      const price = Number(appt.price);
      totalBilled += price;
      if (appt.paid) {
        totalReceived += price;
      } else {
        totalPending += price;
      }
    }

    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};

    for (const exp of expenses) {
      const amt = Number(exp.amount);
      totalExpenses += amt;
      expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + amt;
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
