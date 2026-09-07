import { prisma } from "@/lib/prisma";
import { CreateInvoiceInput } from "@/lib/validations/invoice";
import { Prisma } from "@prisma/client";

export class InvoiceService {
  /**
   * Lista faturas do usuário com paginação e filtro por status
   */
  static async listInvoices(userId: string, status?: string) {
    return prisma.invoice.findMany({
      where: {
        userId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        items: true,
      },
    });
  }

  /**
   * Busca fatura detalhada garantindo isolamento por usuário
   */
  static async getInvoiceById(id: string, userId: string) {
    return prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        client: true,
        items: true,
      },
    });
  }

  /**
   * Cria fatura com cálculo atômico no backend (prevenindo adulteração de valores pelo client)
   */
  static async createInvoice(userId: string, data: CreateInvoiceInput) {
    // Validação de totalização no servidor: nunca confiar no total vindo do cliente
    const totalAmount = data.items.reduce((acc, item) => {
      const itemTotal = new Prisma.Decimal(item.quantity).mul(
        new Prisma.Decimal(item.unitPrice)
      );
      return acc.add(itemTotal);
    }, new Prisma.Decimal(0));

    return prisma.$transaction(async (tx) => {
      // Confirma que o cliente pertence a este usuário
      const client = await tx.client.findFirst({
        where: { id: data.clientId, userId },
      });

      if (!client) {
        throw new Error("Cliente não encontrado ou não autorizado.");
      }

      return tx.invoice.create({
        data: {
          userId,
          clientId: data.clientId,
          invoiceNumber: data.invoiceNumber,
          status: data.status,
          dueDate: new Date(data.dueDate),
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
   * Métricas do Dashboard (total faturado, pendente, clientes ativos)
   */
  static async getDashboardMetrics(userId: string) {
    const [invoices, clientCount] = await Promise.all([
      prisma.invoice.findMany({
        where: { userId },
        select: { status: true, totalAmount: true },
      }),
      prisma.client.count({ where: { userId } }),
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

    return {
      totalPaid,
      totalPending,
      totalOverdue,
      totalInvoices: invoices.length,
      clientCount,
    };
  }
}
