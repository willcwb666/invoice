import { prisma } from "@/lib/prisma";
import { CreateInvoiceInput } from "@/lib/validations/invoice";
import { CompanyService } from "@/services/company-service";
import { Prisma } from "@prisma/client";

export class InvoiceService {
  /**
   * Lista faturas da empresa com ordenação e filtros
   */
  static async listInvoices(companyId: string, status?: string) {
    return prisma.invoice.findMany({
      where: {
        companyId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
        items: true,
      },
    });
  }

  /**
   * Busca fatura detalhada com itens
   */
  static async getInvoiceById(id: string, companyId: string) {
    return prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        items: true,
        company: {
          include: {
            addresses: true,
          },
        },
      },
    });
  }

  /**
   * Cria fatura com cálculo atômico e snapshot do endereço vigente da empresa
   */
  static async createInvoice(companyId: string, data: CreateInvoiceInput) {
    const totalAmount = data.items.reduce((acc, item) => {
      const itemTotal = new Prisma.Decimal(item.quantity).mul(
        new Prisma.Decimal(item.unitPrice)
      );
      return acc.add(itemTotal);
    }, new Prisma.Decimal(0));

    const providerAddress = await CompanyService.getDefaultAddress(companyId);

    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: { id: data.clientId, companyId },
      });

      if (!client) {
        throw new Error("Cliente não encontrado.");
      }

      return tx.invoice.create({
        data: {
          companyId,
          clientId: data.clientId,
          invoiceNumber: data.invoiceNumber,
          status: data.status,
          dueDate: new Date(data.dueDate),
          providerAddress,
          subtotal: totalAmount,
          totalAmount,
          notes: data.notes || null,
          items: {
            create: data.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
              total: new Prisma.Decimal(item.quantity).mul(
                new Prisma.Decimal(item.unitPrice)
              ),
            })),
          },
        },
        include: {
          client: true,
          items: true,
        },
      });
    });
  }

  /**
   * Métricas do Dashboard para a empresa
   */
  static async getDashboardMetrics(companyId: string) {
    const [invoices, clientCount, expenseSum] = await Promise.all([
      prisma.invoice.findMany({
        where: { companyId },
        select: { status: true, totalAmount: true, paidAmount: true },
      }),
      prisma.client.count({ where: { companyId } }),
      prisma.expense.aggregate({
        where: { companyId },
        _sum: { amount: true },
      }),
    ]);

    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    for (const inv of invoices) {
      const val = Number(inv.totalAmount);
      if (inv.status === "PAID") totalPaid += val;
      else if (inv.status === "PENDING") totalPending += val;
      else if (inv.status === "OVERDUE") totalOverdue += val;
    }

    const totalExpenses = Number(expenseSum._sum.amount || 0);
    const netProfit = totalPaid - totalExpenses;

    return {
      totalPaid,
      totalPending,
      totalOverdue,
      totalInvoices: invoices.length,
      clientCount,
      totalExpenses,
      netProfit,
    };
  }
}
